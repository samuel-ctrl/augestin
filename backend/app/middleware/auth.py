"""
Authentication Middleware for EduTrack.

Validates JWT tokens at the middleware level so individual routes
don't need to use Depends(get_current_user). Authenticated user
is stored on request.state.user.

Public paths (e.g. /api/auth/login) skip authentication.
"""

import uuid
import logging

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.context import UserContext, set_current_logged_user
from app.database import async_session
from app.models.user import User
from app.utils.jwt import decode_token

logger = logging.getLogger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS: set[str] = {
    "/",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/auth/login",
}

# Prefixes that don't require authentication
PUBLIC_PREFIXES: tuple[str, ...] = ()


class AuthMiddleware(BaseHTTPMiddleware):
    """
    JWT authentication middleware.

    For every non-public request:
    1. Extracts Bearer token from Authorization header
    2. Decodes and validates the JWT
    3. Loads the User from DB
    4. Sets request.state.user

    Routes access the user via request.state.user instead of Depends().
    """

    def __init__(self, app: ASGIApp, additional_public_paths: set[str] | None = None):
        super().__init__(app)
        self.public_paths = PUBLIC_PATHS.copy()
        if additional_public_paths:
            self.public_paths |= additional_public_paths

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip auth for OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip auth for public paths
        if self._is_public_path(request.url.path):
            return await call_next(request)

        # Extract token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"detail": "Authentication required"},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        token = auth_header[7:]  # Strip "Bearer "

        # Decode JWT
        payload = decode_token(token)
        if payload is None:
            return JSONResponse(
                {"detail": "Invalid or expired token"},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user_id = payload.get("sub")
        if not user_id:
            return JSONResponse(
                {"detail": "Invalid token payload"},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        # Load user from DB
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(User).where(User.id == uuid.UUID(user_id))
                )
                user = result.scalar_one_or_none()
        except Exception:
            logger.exception("Failed to load user from DB during auth")
            return JSONResponse(
                {"detail": "Internal server error"},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if user is None:
            return JSONResponse(
                {"detail": "User not found"},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        # Set user on request state and context var for audit listener
        request.state.user = user
        set_current_logged_user(UserContext(
            user_id=str(user.id),
            name=user.name,
        ))

        return await call_next(request)

    def _is_public_path(self, path: str) -> bool:
        """Check if path is public (no auth required)."""
        if path in self.public_paths:
            return True
        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return True
        return False
