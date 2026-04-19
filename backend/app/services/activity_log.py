"""Activity log service — the only code that writes to activity_logs.

Shared by the ActivityLogMiddleware (for state-changing HTTP requests) and the
login endpoint (for pre-auth events). Logs are immutable: insert-only.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app import database  # use module ref so tests can patch async_session
from app.models.activity_log import ActivityLog

logger = logging.getLogger(__name__)

# Keys whose values are redacted anywhere in the request body tree.
SENSITIVE_KEYS: frozenset[str] = frozenset({
    "password",
    "old_password",
    "new_password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "secret",
    "api_key",
    "client_secret",
})

MAX_BODY_BYTES = 4096
REDACTED = "<redacted>"


def sanitize_body(data: Any) -> Any:
    """Recursively redact sensitive keys. Case-insensitive key match."""
    if isinstance(data, dict):
        return {
            k: (REDACTED if isinstance(k, str) and k.lower() in SENSITIVE_KEYS else sanitize_body(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [sanitize_body(item) for item in data]
    return data


def prepare_body_for_log(raw_body: bytes | None, content_type: str | None) -> dict | list | None:
    """Parse+sanitize a request body, or return a truncation marker for oversized bodies.

    Returns None for non-JSON, empty, or unparseable bodies.
    """
    if not raw_body:
        return None
    if not content_type or "application/json" not in content_type.lower():
        return None
    if len(raw_body) > MAX_BODY_BYTES:
        return {"_truncated": True, "size_bytes": len(raw_body)}
    try:
        parsed = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    sanitized = sanitize_body(parsed)
    # Re-check size after sanitization (usually shrinks, but defensive)
    try:
        if len(json.dumps(sanitized).encode()) > MAX_BODY_BYTES:
            return {"_truncated": True, "size_bytes": len(raw_body)}
    except (TypeError, ValueError):
        return None
    return sanitized


async def log_activity(
    *,
    started_at: datetime,
    ended_at: datetime | None = None,
    actor_id: uuid.UUID | str | None = None,
    actor_name: str | None = None,
    actor_type: str | None = None,
    action: str,
    method: str,
    path: str,
    target_type: str | None = None,
    target_id: uuid.UUID | str | None = None,
    target_name: str | None = None,
    status_code: int | None = None,
    outcome: str | None = None,
    error_message: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """Insert a single activity log row in a fresh session. Never raises."""
    end_time = ended_at or datetime.now(timezone.utc)
    duration_ms = int((end_time - started_at).total_seconds() * 1000)

    try:
        actor_uuid = uuid.UUID(str(actor_id)) if actor_id else None
    except (ValueError, TypeError):
        actor_uuid = None

    try:
        target_uuid = uuid.UUID(str(target_id)) if target_id else None
    except (ValueError, TypeError):
        target_uuid = None

    row = ActivityLog(
        started_at=started_at,
        ended_at=end_time,
        duration_ms=duration_ms,
        actor_id=actor_uuid,
        actor_name=actor_name,
        actor_type=actor_type,
        action=action,
        method=method,
        path=path,
        target_type=target_type,
        target_id=target_uuid,
        target_name=target_name,
        status_code=status_code,
        outcome=outcome,
        error_message=error_message,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        meta=meta,
    )

    import sys
    from sqlalchemy import func as sqlfunc, select as sqlselect
    try:
        factory = database.async_session
        async with factory() as session:
            session.add(row)
            await session.commit()
            # Verify visible within same session after commit
            cnt = (await session.execute(sqlselect(sqlfunc.count()).select_from(ActivityLog))).scalar()
            print(f"!!! LOG WRITTEN: action={action}, cnt_after_commit={cnt}", file=sys.stderr, flush=True)
        # Verify from a fresh session after 'async with' exits
        async with factory() as s2:
            cnt2 = (await s2.execute(sqlselect(sqlfunc.count()).select_from(ActivityLog))).scalar()
            print(f"!!! fresh session cnt={cnt2}", file=sys.stderr, flush=True)
    except Exception as exc:
        print(f"\n!!! LOG FAILED: action={action}, err={exc!r}", file=sys.stderr, flush=True)
        logger.exception("Failed to write activity log row (action=%s, path=%s)", action, path)


def log_activity_background(**kwargs: Any) -> None:
    """Fire-and-forget wrapper: schedule the insert without awaiting it.

    Used by the middleware so logging never blocks the response. Exceptions
    inside the task are logged by log_activity itself and never propagate.
    """
    try:
        asyncio.create_task(log_activity(**kwargs))
    except RuntimeError:
        # No running event loop — shouldn't happen under FastAPI, but safe fallback.
        logger.debug("No event loop available for background activity log; skipping")
