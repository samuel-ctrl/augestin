"""Activity log middleware.

Wraps AuthMiddleware (registered after Auth in main.py — Starlette's
last-added-is-outermost rule places Activity outside Auth). After
call_next returns, it reads request.state.user (populated by Auth during
call_next) and writes one activity_logs row via the shared log_activity
service.

Hard rules:
- Only state-changing HTTP methods are logged (GETs excluded).
- Logging is fire-and-forget — never blocks the response, never bubbles errors.
- Request body captured + sanitized into meta.request_body for JSON bodies only.
- Response body NOT captured (could contain JWTs / generated passwords); only
  the 4xx/5xx "detail" field is extracted as error_message.
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.services.activity_log import (
    log_activity_background,
    prepare_body_for_log,
)

logger = logging.getLogger(__name__)

STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Explicit opt-outs: handled by the endpoint itself (login) or pure
# infra paths we don't want to flood the log with.
# NOTE: matched by exact string, so any path added here must be static.
SKIP_PATHS: set[str] = {"/api/auth/login", "/api/streak/heartbeat"}


class ActivityLogMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        # Fast-skip non-logged requests — zero overhead.
        if request.scope.get("type") != "http":
            return await call_next(request)
        if request.method not in STATE_CHANGING_METHODS:
            return await call_next(request)
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        started_at = datetime.now(timezone.utc)

        # Capture + replay request body so the handler can still read it.
        raw_body: bytes = b""
        try:
            raw_body = await request.body()
        except Exception:
            logger.debug("Failed to read request body for activity log", exc_info=True)

        async def _replay_receive():
            return {"type": "http.request", "body": raw_body, "more_body": False}

        request._receive = _replay_receive  # type: ignore[attr-defined]

        # Run the downstream stack. Catch exceptions so we always log.
        response: Response | None = None
        exc_raised: BaseException | None = None
        try:
            response = await call_next(request)
        except BaseException as exc:  # noqa: BLE001
            exc_raised = exc

        ended_at = datetime.now(timezone.utc)

        # --- Assemble the log row ---
        user = getattr(request.state, "user", None)

        route = request.scope.get("route")
        route_name = getattr(route, "name", None) if route else None
        if route_name:
            action = route_name
        elif response is not None and response.status_code == 401:
            action = "unauthenticated_request"
        elif exc_raised is not None:
            action = f"{request.method.lower()}:{request.url.path}"
        else:
            action = f"{request.method.lower()}:{request.url.path}"

        target_type = _derive_target_type(request.url.path)
        target_id = _derive_target_id(request.path_params)

        meta: dict = {}

        # Capture parent path params as context (everything except the target)
        parent_params = _derive_parent_params(request.path_params, target_id)
        if parent_params:
            meta["parent"] = parent_params

        body_for_log = prepare_body_for_log(
            raw_body, request.headers.get("content-type")
        )
        if body_for_log is not None:
            meta["request_body"] = body_for_log

        # Determine outcome + error_message
        if exc_raised is not None:
            outcome = "exception"
            status_code = 500
            error_message = str(exc_raised)[:1000] or exc_raised.__class__.__name__
        else:
            assert response is not None
            status_code = response.status_code
            outcome, error_message = await _classify_response(response)

        # Actor fields
        if user is not None:
            actor_id = getattr(user, "id", None)
            actor_name = getattr(user, "name", None)
            user_type = getattr(user, "user_type", None)
            actor_type = getattr(user_type, "value", None) if user_type else None
        else:
            actor_id = None
            actor_name = None
            actor_type = None

        # Request metadata
        ip_address = _extract_client_ip(request)
        user_agent = request.headers.get("user-agent")
        if user_agent and len(user_agent) > 500:
            user_agent = user_agent[:500]
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())

        log_activity_background(
            started_at=started_at,
            ended_at=ended_at,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_type=actor_type,
            action=action,
            method=request.method,
            path=request.url.path,
            target_type=target_type,
            target_id=target_id,
            target_name=None,
            status_code=status_code,
            outcome=outcome,
            error_message=error_message,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            meta=meta or None,
        )

        if exc_raised is not None:
            raise exc_raised
        return response  # type: ignore[return-value]


def _derive_target_type(path: str) -> str | None:
    """Derive target_type from first segment after /api/ (e.g. /api/students/... -> 'students')."""
    if not path.startswith("/api/"):
        return None
    parts = path[len("/api/") :].split("/", 1)
    return parts[0] if parts and parts[0] else None


def _derive_target_id(path_params) -> uuid.UUID | None:
    """Last path param that parses as UUID — handles nested routes like
    /books/{book_id}/questions/{question_id} where the question is the target."""
    if not path_params:
        return None
    result: uuid.UUID | None = None
    for value in path_params.values():
        if isinstance(value, uuid.UUID):
            result = value
        elif isinstance(value, str):
            try:
                result = uuid.UUID(value)
            except (ValueError, TypeError):
                continue
    return result


def _derive_parent_params(path_params, target_id: uuid.UUID | None) -> dict | None:
    """Collect non-target path params as context (stored in meta.parent).

    Preserves everything except the actual target UUID so nested context
    (book_id when the target is a question) is recoverable.
    """
    if not path_params:
        return None
    out = {}
    for key, value in path_params.items():
        if isinstance(value, uuid.UUID):
            if target_id is not None and value == target_id:
                continue
            out[key] = str(value)
        elif isinstance(value, str):
            try:
                parsed = uuid.UUID(value)
                if target_id is not None and parsed == target_id:
                    continue
                out[key] = value
            except (ValueError, TypeError):
                out[key] = value
        else:
            out[key] = value
    return out or None


async def _classify_response(response: Response) -> tuple[str, str | None]:
    """Return (outcome, error_message) for a response.

    Reads + replays the response body ONLY for 4xx/5xx so we can surface
    the 'detail' field. Success responses are not touched.
    """
    status = response.status_code
    if 200 <= status < 400:
        return "success", None

    # Read streamed body, then replace the iterator so the response is still
    # sent to the client correctly.
    body_chunks: list[bytes] = []
    try:
        async for chunk in response.body_iterator:  # type: ignore[attr-defined]
            body_chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    except Exception:
        logger.debug("Failed to read response body for activity log", exc_info=True)
        return _outcome_for(status), None
    body_bytes = b"".join(body_chunks)

    async def _replay():
        yield body_bytes

    response.body_iterator = _replay()  # type: ignore[attr-defined]

    # Parse detail field if JSON, else leave error_message blank.
    error_message: str | None = None
    if body_bytes:
        try:
            parsed = json.loads(body_bytes)
            if isinstance(parsed, dict):
                detail = parsed.get("detail")
                if isinstance(detail, str):
                    error_message = detail[:1000]
                elif detail is not None:
                    error_message = json.dumps(detail)[:1000]
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    return _outcome_for(status), error_message


def _outcome_for(status: int) -> str:
    if 400 <= status < 500:
        return "client_error"
    if 500 <= status < 600:
        return "server_error"
    return "success"


def _extract_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        return first[:64] if first else None
    if request.client:
        return request.client.host[:64]
    return None
