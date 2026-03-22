import math
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.subject import Subject
from app.models.user import User, UserType

VALID_ICONS = {
    "book", "atom", "calculator", "flask", "microscope", "globe",
    "palette", "music", "dumbbell", "laptop", "language", "history",
    "economics", "civics", "leaf", "dna", "lightning", "compass",
    "ruler", "pen",
}


async def create_subject(db: AsyncSession, name: str, icon: str | None) -> Subject:
    if icon and icon not in VALID_ICONS:
        raise ValueError(f"Invalid icon '{icon}'. Must be one of: {', '.join(sorted(VALID_ICONS))}")
    subject = Subject(name=name, icon=icon or "book")
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


async def get_subject(db: AsyncSession, subject_id: uuid.UUID) -> Subject | None:
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    return result.scalar_one_or_none()


async def update_subject(
    db: AsyncSession, subject: Subject, name: str | None = None, icon: str | None = None,
) -> Subject:
    if name is not None:
        subject.name = name
    if icon is not None:
        if icon not in VALID_ICONS:
            raise ValueError(f"Invalid icon '{icon}'. Must be one of: {', '.join(sorted(VALID_ICONS))}")
        subject.icon = icon
    await db.commit()
    await db.refresh(subject)
    return subject


async def delete_subject(db: AsyncSession, subject: Subject) -> None:
    await db.delete(subject)
    await db.commit()


async def list_subjects(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "name",
    sort_order: str = "asc",
) -> tuple[list[dict], int, int, int, int]:
    if user.user_type == UserType.tutor:
        # Tutor sees all subjects with book count
        query = select(Subject, func.count(Book.id).label("book_count")).outerjoin(
            Book, Book.subject_id == Subject.id
        ).group_by(Subject.id)

        if search:
            query = query.where(Subject.name.ilike(f"%{search}%"))

        # Count total
        count_base = select(Subject)
        if search:
            count_base = count_base.where(Subject.name.ilike(f"%{search}%"))
        count_q = select(func.count()).select_from(count_base.subquery())
        total = (await db.execute(count_q)).scalar() or 0
    else:
        # Student sees only subjects that have books assigned to them
        query = (
            select(Subject, func.count(Book.id.distinct()).label("book_count"))
            .join(Book, Book.subject_id == Subject.id)
            .join(BookAssignment, BookAssignment.book_id == Book.id)
            .where(BookAssignment.student_id == user.id)
            .group_by(Subject.id)
        )

        if search:
            query = query.where(Subject.name.ilike(f"%{search}%"))

        count_base = (
            select(Subject.id.distinct())
            .join(Book, Book.subject_id == Subject.id)
            .join(BookAssignment, BookAssignment.book_id == Book.id)
            .where(BookAssignment.student_id == user.id)
        )
        if search:
            count_base = count_base.where(Subject.name.ilike(f"%{search}%"))
        count_q = select(func.count()).select_from(count_base.subquery())
        total = (await db.execute(count_q)).scalar() or 0

    # Sort
    allowed_sort = {"name", "created_at"}
    if sort_by not in allowed_sort:
        sort_by = "name"
    sort_col = getattr(Subject, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order)

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    items = []
    for row in rows:
        subject = row[0]
        book_count = row[1]
        items.append({
            "subject": subject,
            "book_count": book_count,
        })

    return items, total, page, page_size, total_pages
