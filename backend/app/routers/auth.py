from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_current_user_db, get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, UserOut
from app.services.auth import authenticate_user, change_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await authenticate_user(db, body.login_id, body.password)
    if result is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token, user = result
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
