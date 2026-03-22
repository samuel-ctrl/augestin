import math
import uuid

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import VALID_STANDARDS, User, UserType
from app.utils.id_generator import generate_password, generate_student_id
from app.utils.password import hash_password


def _validate_standard(standard: str | None) -> str | None:
    if standard is None:
        return None
    if standard not in VALID_STANDARDS:
        raise ValueError(f"Invalid standard '{standard}'. Must be one of: {', '.join(VALID_STANDARDS)}")
    return standard


async def _generate_unique_login_id(db: AsyncSession, email: str | None, phone: str | None) -> str:
    if email:
        existing = await db.execute(select(User).where(User.login_id == email))
        if existing.scalar_one_or_none() is None:
            return email
    if phone:
        existing = await db.execute(select(User).where(User.login_id == phone))
        if existing.scalar_one_or_none() is None:
            return phone
    # Generate STU-XXXXXX
    for _ in range(10):
        login_id = generate_student_id()
        existing = await db.execute(select(User).where(User.login_id == login_id))
        if existing.scalar_one_or_none() is None:
            return login_id
    raise ValueError("Failed to generate unique student ID")


async def create_student(
    db: AsyncSession,
    name: str,
    email: str | None = None,
    phone: str | None = None,
    standard: str | None = None,
) -> tuple[User, str]:
    validated_standard = _validate_standard(standard)
    login_id = await _generate_unique_login_id(db, email, phone)
    plain_password = generate_password()

    # Check for existing email/phone before creating
    if email:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none() is not None:
            raise ValueError(f"A student with email '{email}' already exists")
    if phone:
        existing = await db.execute(select(User).where(User.phone == phone))
        if existing.scalar_one_or_none() is not None:
            raise ValueError(f"A student with phone '{phone}' already exists")

    student = User(
        login_id=login_id,
        name=name,
        email=email if email else None,
        phone=phone if phone else None,
        password_hash=hash_password(plain_password),
        user_type=UserType.student,
        standard=validated_standard,
        must_change_password=True,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student, plain_password


async def list_students(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    sort_by: str = "created_at",
    sort_order: str = "desc",
    standard: str | None = None,
) -> tuple[list[User], int, int, int, int]:
    query = select(User).where(User.user_type == UserType.student)

    # Search
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                User.name.ilike(search_term),
                User.login_id.ilike(search_term),
                User.email.ilike(search_term),
                User.phone.ilike(search_term),
            )
        )

    # Filter by standard
    if standard:
        query = query.where(User.standard == standard)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    allowed_sort = {"name", "login_id", "standard", "created_at", "updated_at"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    sort_column = getattr(User, sort_by)
    if sort_by == "standard":
        sort_column = cast(User.standard, String)
    order = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(order)

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    students = list(result.scalars().all())
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return students, total, page, page_size, total_pages


async def get_student(db: AsyncSession, student_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.id == student_id, User.user_type == UserType.student)
    )
    return result.scalar_one_or_none()


async def update_student(
    db: AsyncSession,
    student: User,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    standard: str | None = None,
) -> User:
    if name is not None:
        student.name = name
    if email is not None:
        if email:
            existing = await db.execute(
                select(User).where(User.email == email, User.id != student.id)
            )
            if existing.scalar_one_or_none() is not None:
                raise ValueError(f"A student with email '{email}' already exists")
        student.email = email if email else None
    if phone is not None:
        if phone:
            existing = await db.execute(
                select(User).where(User.phone == phone, User.id != student.id)
            )
            if existing.scalar_one_or_none() is not None:
                raise ValueError(f"A student with phone '{phone}' already exists")
        student.phone = phone if phone else None
    if standard is not None:
        student.standard = _validate_standard(standard) if standard else None
    await db.commit()
    await db.refresh(student)
    return student


async def delete_student(db: AsyncSession, student: User) -> None:
    await db.delete(student)
    await db.commit()


async def reset_password(db: AsyncSession, student: User) -> str:
    plain_password = generate_password()
    student.password_hash = hash_password(plain_password)
    student.must_change_password = True
    await db.commit()
    return plain_password
