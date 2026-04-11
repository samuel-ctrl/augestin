import uuid

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.book import Book
from app.models.doubt import Doubt, DoubtComment
from app.models.user import User


async def create_doubt(
    db: AsyncSession,
    student_id: uuid.UUID,
    title: str,
    description: str,
    book_id: uuid.UUID | None = None,
    attachment_links: list[str] | None = None,
) -> Doubt:
    if book_id:
        result = await db.execute(select(Book).where(Book.id == book_id))
        if not result.scalar_one_or_none():
            raise ValueError("Book not found")

    doubt = Doubt(
        student_id=student_id,
        book_id=book_id,
        title=title,
        description=description,
        status="open",
        attachment_links=attachment_links or [],
    )
    db.add(doubt)
    await db.commit()
    await db.refresh(doubt)
    return doubt


async def list_doubts(
    db: AsyncSession,
    page: int,
    page_size: int,
    search: str = "",
    status_filter: str | None = None,
    book_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    standard: str | None = None,
    section: str | None = None,
) -> tuple[list[dict], int, int, int, int]:
    """List doubts with student name, book title, and comment count."""
    comment_count = (
        select(func.count(DoubtComment.id))
        .where(DoubtComment.doubt_id == Doubt.id)
        .correlate(Doubt)
        .scalar_subquery()
    )

    query = (
        select(Doubt, User.name.label("student_name"), Book.title.label("book_title"), comment_count.label("comment_count"))
        .join(User, Doubt.student_id == User.id)
        .outerjoin(Book, Doubt.book_id == Book.id)
    )

    if search:
        query = query.where(
            or_(
                Doubt.title.ilike(f"%{search}%"),
                Doubt.description.ilike(f"%{search}%"),
            )
        )

    if status_filter:
        query = query.where(Doubt.status == status_filter)

    if book_id:
        query = query.where(Doubt.book_id == book_id)

    if student_id:
        query = query.where(Doubt.student_id == student_id)

    if standard:
        query = query.where(User.standard == standard)

    if section:
        query = query.where(User.section == section)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Doubt.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).all()

    items = []
    for doubt, student_name, book_title, cc in results:
        items.append({
            "id": str(doubt.id),
            "title": doubt.title,
            "description": doubt.description,
            "status": doubt.status,
            "student_id": str(doubt.student_id),
            "student_name": student_name,
            "book_id": str(doubt.book_id) if doubt.book_id else None,
            "book_title": book_title,
            "attachment_links": doubt.attachment_links or [],
            "comment_count": cc or 0,
            "created_at": doubt.created_at,
            "updated_at": doubt.updated_at,
        })

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return items, total, page, page_size, total_pages


async def get_doubt(db: AsyncSession, doubt_id: uuid.UUID) -> Doubt | None:
    result = await db.execute(
        select(Doubt)
        .options(selectinload(Doubt.comments).selectinload(DoubtComment.user))
        .options(selectinload(Doubt.student))
        .options(selectinload(Doubt.book))
        .where(Doubt.id == doubt_id)
    )
    return result.scalar_one_or_none()


async def update_doubt(
    db: AsyncSession,
    doubt: Doubt,
    title: str | None = None,
    description: str | None = None,
    attachment_links: list[str] | None = None,
) -> Doubt:
    if title is not None:
        doubt.title = title
    if description is not None:
        doubt.description = description
    if attachment_links is not None:
        doubt.attachment_links = attachment_links
    await db.commit()
    await db.refresh(doubt)
    return doubt


async def delete_doubt(db: AsyncSession, doubt: Doubt) -> None:
    await db.delete(doubt)
    await db.commit()


async def update_doubt_status(db: AsyncSession, doubt: Doubt, status: str) -> Doubt:
    doubt.status = status
    await db.commit()
    await db.refresh(doubt)
    return doubt


async def create_comment(
    db: AsyncSession,
    doubt_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str,
) -> DoubtComment:
    comment = DoubtComment(
        doubt_id=doubt_id,
        user_id=user_id,
        content=content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def get_comment(db: AsyncSession, comment_id: uuid.UUID) -> DoubtComment | None:
    result = await db.execute(select(DoubtComment).where(DoubtComment.id == comment_id))
    return result.scalar_one_or_none()


async def update_comment(db: AsyncSession, comment: DoubtComment, content: str) -> DoubtComment:
    comment.content = content
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_comment(db: AsyncSession, comment: DoubtComment) -> None:
    await db.delete(comment)
    await db.commit()
