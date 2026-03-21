from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.jwt import create_token
from app.utils.password import hash_password, verify_password


async def authenticate_user(db: AsyncSession, login_id: str, password: str) -> tuple[str, User] | None:
    result = await db.execute(select(User).where(User.login_id == login_id))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        return None
    token = create_token(str(user.id), user.user_type.value)
    return token, user


async def change_password(db: AsyncSession, user: User, old_password: str, new_password: str) -> bool:
    if not verify_password(old_password, user.password_hash):
        return False
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    await db.commit()
    await db.refresh(user)
    return True
