import math
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book_assignment import BookAssignment
from app.models.user import User


async def assign_book(
    db: AsyncSession,
    book_id: uuid.UUID,
    student_ids: list[uuid.UUID],
    tutor_id: uuid.UUID,
) -> int:
    created = 0
    for student_id in student_ids:
        # Skip duplicates
        existing = await db.execute(
            select(BookAssignment).where(
                BookAssignment.book_id == book_id,
                BookAssignment.student_id == student_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue
        assignment = BookAssignment(
            book_id=book_id,
            student_id=student_id,
            assigned_by=tutor_id,
        )
        db.add(assignment)
        created += 1
    await db.commit()
    return created


async def delete_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(BookAssignment).where(BookAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        return False
    await db.delete(assignment)
    await db.commit()
    return True


async def list_assignments_by_book(
    db: AsyncSession,
    book_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    sort_by: str = "assigned_at",
    sort_order: str = "desc",
) -> tuple[list[tuple], int, int, int, int]:
    query = (
        select(BookAssignment, User)
        .join(User, BookAssignment.student_id == User.id)
        .where(BookAssignment.book_id == book_id)
    )

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(User.name.ilike(search_term), User.login_id.ilike(search_term))
        )

    # Count
    count_base = select(BookAssignment).where(BookAssignment.book_id == book_id)
    if search:
        count_base = (
            count_base.join(User, BookAssignment.student_id == User.id)
            .where(or_(User.name.ilike(f"%{search}%"), User.login_id.ilike(f"%{search}%")))
        )
    count_q = select(func.count()).select_from(count_base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    allowed = {"assigned_at"}
    if sort_by not in allowed:
        sort_by = "assigned_at"
    sort_col = getattr(BookAssignment, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return rows, total, page, page_size, total_pages
