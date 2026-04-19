from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_current_user_db, get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, UserOut
from app.services.auth import authenticate_user, change_password
from app.services.activity_log import log_activity_background

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        return first[:64] if first else None
    if request.client:
        return request.client.host[:64]
    return None


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    started_at = datetime.now(timezone.utc)
    result = await authenticate_user(db, body.login_id, body.password)

    log_kwargs = {
        "started_at": started_at,
        "method": request.method,
        "path": request.url.path,
        "ip_address": _client_ip(request),
        "user_agent": (request.headers.get("user-agent") or None),
        "request_id": request.headers.get("x-request-id"),
    }

    if result is None:
        log_activity_background(
            action="login_failed",
            actor_id=None,
            actor_name=body.login_id,
            actor_type=None,
            status_code=401,
            outcome="client_error",
            error_message="Invalid credentials",
            **log_kwargs,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token, user = result
    log_activity_background(
        action="login",
        actor_id=user.id,
        actor_name=user.name,
        actor_type=user.user_type.value,
        target_type="users",
        target_id=user.id,
        target_name=user.name,
        status_code=200,
        outcome="success",
        **log_kwargs,
    )
    return LoginResponse(
        token=token,
        user=UserOut(
            id=str(user.id),
            login_id=user.login_id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            user_type=user.user_type.value,
            standard=user.standard if user.standard else None,
            must_change_password=user.must_change_password,
        ),
    )


@router.get("/me", response_model=UserOut)
async def me(request: Request):
    current_user: User = get_current_user(request)
    return UserOut(
        id=str(current_user.id),
        login_id=current_user.login_id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        user_type=current_user.user_type.value,
        standard=current_user.standard if current_user.standard else None,
        must_change_password=current_user.must_change_password,
    )


@router.put("/change-password")
async def change_pwd(
    body: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user: User = await get_current_user_db(request, db)
    success = await change_password(db, current_user, body.old_password, body.new_password)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect old password")
    return {"detail": "Password changed successfully"}
