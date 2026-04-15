"""
Admin endpoints guarded by HTTP Basic Auth (no JWT).

Credentials come from env vars ADMIN_BASIC_USER / ADMIN_BASIC_PASS.
"""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.models.user import User, UserType
from app.utils.password import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])

security = HTTPBasic()


def verify_basic_auth(credentials: Annotated[HTTPBasicCredentials, Depends(security)]):
    expected_user = settings.ADMIN_BASIC_USER
    expected_pass = settings.ADMIN_BASIC_PASS

    if not expected_user or not expected_pass:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin credentials not configured on server.",
        )

    user_ok = secrets.compare_digest(credentials.username.encode("utf-8"), expected_user.encode("utf-8"))
    pass_ok = secrets.compare_digest(credentials.password.encode("utf-8"), expected_pass.encode("utf-8"))
    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


class SeedSuperUserRequest(BaseModel):
    login_id: str = Field(default="ajedutrack@edu.in")
    name: str = Field(default="Augustin Josephraj")
    password: str = Field(default="jose@27")


class SeedSuperUserResponse(BaseModel):
    action: str
    login_id: str


@router.post("/seed-super-user", response_model=SeedSuperUserResponse)
async def seed_super_user(
    payload: SeedSuperUserRequest,
    _: Annotated[str, Depends(verify_basic_auth)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.login_id == payload.login_id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.name = payload.name
        existing.password_hash = hash_password(payload.password)
        await db.commit()
        return SeedSuperUserResponse(action="updated", login_id=payload.login_id)

    tutor = User(
        login_id=payload.login_id,
        name=payload.name,
        email=payload.login_id,
        password_hash=hash_password(payload.password),
        user_type=UserType.tutor,
        must_change_password=False,
    )
    db.add(tutor)
    await db.commit()
    return SeedSuperUserResponse(action="created", login_id=payload.login_id)
