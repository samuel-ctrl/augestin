from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserType
from app.utils.password import hash_password


async def seed_super_user(db: AsyncSession):
    result = await db.execute(select(User).where(User.login_id == "tutor@gmail.com"))
    existing = result.scalar_one_or_none()
    if existing:
        return

    tutor = User(
        login_id="tutor@gmail.com",
        name="Super Tutor",
        email="tutor@gmail.com",
        password_hash=hash_password("Tutor@123"),
        user_type=UserType.tutor,
        must_change_password=False,
    )
    db.add(tutor)
    await db.commit()
    print("Seeded super user tutor: tutor@gmail.com / Tutor@123")
