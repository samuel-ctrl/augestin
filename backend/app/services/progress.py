import uuid
from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.subject import Subject
from app.models.topic import Topic
from app.models.watch_progress import WatchProgress


async def _validate_topic_assignment(
    db: AsyncSession,
    student_id: uuid.UUID,
    topic_id: uuid.UUID,
) -> Topic:
    """Verify the topic exists and the student is assigned to its parent book."""
    topic_result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise ValueError("Topic not found")

    assignment = await db.execute(
        select(BookAssignment).where(
            and_(
                BookAssignment.book_id == topic.book_id,
                BookAssignment.student_id == student_id,
            )
        )
    )
    if assignment.scalar_one_or_none() is None:
        raise ValueError("Book is not assigned to this student")

    return topic


async def upsert_progress(
    db: AsyncSession,
    student_id: uuid.UUID,
    topic_id: uuid.UUID,
    watch_percentage: float,
    last_position_seconds: float,
) -> WatchProgress:
    await _validate_topic_assignment(db, student_id, topic_id)

    watch_percentage = max(0.0, min(100.0, watch_percentage))
    completed = watch_percentage >= 90.0

    result = await db.execute(
        select(WatchProgress).where(
            and_(
                WatchProgress.student_id == student_id,
                WatchProgress.topic_id == topic_id,
            )
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        progress = WatchProgress(
            student_id=student_id,
            topic_id=topic_id,
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


async def mark_topic_watched(
    db: AsyncSession,
    student_id: uuid.UUID,
    topic_id: uuid.UUID,
) -> WatchProgress:
    """Idempotent mark-watched — sets completed=True immediately."""
    await _validate_topic_assignment(db, student_id, topic_id)

    result = await db.execute(
        select(WatchProgress).where(
            and_(
                WatchProgress.student_id == student_id,
                WatchProgress.topic_id == topic_id,
            )
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        progress = WatchProgress(
            student_id=student_id,
            topic_id=topic_id,
            watch_percentage=100.0,
            last_position_seconds=0.0,
            completed=True,
            last_watched_at=datetime.utcnow(),
        )
        db.add(progress)
    else:
        progress.completed = True
        progress.watch_percentage = max(progress.watch_percentage, 100.0)
        progress.last_watched_at = datetime.utcnow()

    await db.commit()
    await db.refresh(progress)
    return progress


async def get_resume_topic(db: AsyncSession, student_id: uuid.UUID) -> dict | None:
    """Return the most recently watched topic with enough context to resume."""
    result = await db.execute(
        select(WatchProgress, Topic, Book, Subject)
        .join(Topic, WatchProgress.topic_id == Topic.id)
        .join(Book, Topic.book_id == Book.id)
        .join(Subject, Book.subject_id == Subject.id)
        .where(WatchProgress.student_id == student_id)
        .order_by(WatchProgress.last_watched_at.desc())
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None

    wp, topic, book, subject = row
    return {
        "topic_id": str(topic.id),
        "topic_title": topic.title,
        "book_id": str(book.id),
        "book_title": book.title,
        "subject_id": str(subject.id),
        "subject_name": subject.name,
        "thumbnail_url": book.thumbnail_url,
        "watch_percentage": wp.watch_percentage,
        "last_position_seconds": wp.last_position_seconds,
    }
