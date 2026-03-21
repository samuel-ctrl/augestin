import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.subject import Subject
from app.models.watch_progress import WatchProgress


async def upsert_progress(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
    watch_percentage: float,
    last_position_seconds: float,
) -> WatchProgress:
    # Validate assignment exists
    assignment = await db.execute(
        select(BookAssignment).where(
            BookAssignment.book_id == book_id,
            BookAssignment.student_id == student_id,
        )
    )
    if assignment.scalar_one_or_none() is None:
        raise ValueError("Book is not assigned to this student")

    # Clamp percentage
    watch_percentage = max(0.0, min(100.0, watch_percentage))
    completed = watch_percentage >= 90.0

    # Upsert
    result = await db.execute(
        select(WatchProgress).where(
            WatchProgress.student_id == student_id,
            WatchProgress.book_id == book_id,
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        progress = WatchProgress(
            student_id=student_id,
            book_id=book_id,
            watch_percentage=watch_percentage,
            last_position_seconds=last_position_seconds,
            completed=completed,
            last_watched_at=datetime.utcnow(),
        )
        db.add(progress)
    else:
        progress.watch_percentage = watch_percentage
        progress.last_position_seconds = last_position_seconds
        progress.completed = completed
        progress.last_watched_at = datetime.utcnow()

    await db.commit()
    await db.refresh(progress)
    return progress


async def get_resume_book(db: AsyncSession, student_id: uuid.UUID) -> dict | None:
    result = await db.execute(
        select(WatchProgress, Book, Subject)
        .join(Book, WatchProgress.book_id == Book.id)
        .join(Subject, Book.subject_id == Subject.id)
        .where(WatchProgress.student_id == student_id)
        .order_by(WatchProgress.last_watched_at.desc())
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None

    wp, book, subject = row
    return {
        "book_id": str(book.id),
        "book_title": book.title,
        "subject_id": str(subject.id),
        "subject_name": subject.name,
        "thumbnail_url": book.thumbnail_url,
        "watch_percentage": wp.watch_percentage,
        "last_position_seconds": wp.last_position_seconds,
    }
