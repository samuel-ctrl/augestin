from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db  # noqa: F401 — re-exported for routers
from app.models.user import User, UserType


def get_current_user(request: Request) -> User:
    """Extract the authenticated user set by AuthMiddleware (read-only, detached from DB session)."""
    user: User | None = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


async def get_current_user_db(request: Request, db: AsyncSession) -> User:
    """Re-fetch the authenticated user in the route's DB session (for mutations)."""
    middleware_user = get_current_user(request)
    result = await db.execute(select(User).where(User.id == middleware_user.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_tutor(request: Request) -> User:
    """Extract user and verify they are a tutor."""
    user = get_current_user(request)
    if user.user_type != UserType.tutor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tutor access required",
        )
    return user


def require_student(request: Request) -> User:
    """Extract user and verify they are a student."""
    user = get_current_user(request)
    if user.user_type != UserType.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required",
        )
    return user
