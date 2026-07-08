import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_recap import BookRecap
from app.services.topic import MAX_CONTENT_SIZE, validate_and_clean_content


async def get_book_recap(db: AsyncSession, book_id: uuid.UUID, student_id: uuid.UUID) -> BookRecap | None:
    result = await db.execute(
        select(BookRecap).where(BookRecap.book_id == book_id, BookRecap.student_id == student_id)
    )
    return result.scalar_one_or_none()


async def create_or_update_book_recap(
    db: AsyncSession,
    book_id: uuid.UUID,
    student_id: uuid.UUID,
    title: str,
    content: dict,
) -> BookRecap:
    book = await db.execute(select(Book).where(Book.id == book_id))
    if book.scalar_one_or_none() is None:
        raise ValueError("Book not found")

    content_json = json.dumps(content)
    if len(content_json.encode("utf-8")) > MAX_CONTENT_SIZE:
        raise ValueError(f"Content exceeds maximum size of {MAX_CONTENT_SIZE / (1024 * 1024):.1f}MB")

    cleaned = validate_and_clean_content(content)

    recap = await get_book_recap(db, book_id, student_id)
    if recap:
        recap.title = title
        recap.content = cleaned
        recap.updated_at = datetime.now(timezone.utc)
    else:
        recap = BookRecap(
            book_id=book_id,
            student_id=student_id,
            title=title,
            content=cleaned,
        )
        db.add(recap)

    await db.commit()
    await db.refresh(recap)
    return recap
