import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.topic import Topic
from app.models.topic_notes import TopicNotes
from app.models.watch_progress import WatchProgress
from app.models.quiz_progress import QuizProgress
from app.services.book import validate_url

logger = logging.getLogger(__name__)

SUPPORTED_NODE_TYPES = {
    "doc", "document", "paragraph", "text", "heading",
    "bulletList", "orderedList", "listItem",
    "bold", "italic", "code", "codeBlock",
    "image", "link", "horizontalRule", "blockquote", "hardBreak",
}

MAX_CONTENT_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_and_clean_content(content: dict) -> dict:
    """Validate Tiptap JSON content and strip unsupported node types."""
    if not isinstance(content, dict):
        return {}

    def clean_node(node: dict) -> dict | None:
        if not isinstance(node, dict):
            return node
        node_type = node.get("type")
        if node_type and node_type not in SUPPORTED_NODE_TYPES:
            logger.warning("Removing unsupported node type: %s", node_type)
            return None
        if "content" in node and isinstance(node["content"], list):
            node["content"] = [c for c in (clean_node(ch) for ch in node["content"]) if c is not None]
        if "marks" in node and isinstance(node["marks"], list):
            node["marks"] = [m for m in node["marks"] if isinstance(m, dict) and m.get("type") in SUPPORTED_NODE_TYPES]
        return node

    cleaned = clean_node(content)
    return cleaned if cleaned else {}


async def _next_position(db: AsyncSession, book_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(Topic.position), -1)).where(Topic.book_id == book_id)
    )
    return (result.scalar() or -1) + 1


async def create_topic(
    db: AsyncSession,
    book_id: uuid.UUID,
    title: str,
    video_url: str | None = None,
    image_url: str | None = None,
) -> Topic:
    # At least one media source is required
    if not video_url and not image_url:
        raise ValueError("A topic must have at least a video_url or an image_url")

    book = await db.execute(select(Book).where(Book.id == book_id))
    if book.scalar_one_or_none() is None:
        raise ValueError("Book not found")

    if video_url:
        validate_url(video_url)
    if image_url:
        validate_url(image_url)

    position = await _next_position(db, book_id)

    topic = Topic(
        book_id=book_id,
        title=title,
        position=position,
        video_url=video_url,
        image_url=image_url,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


async def get_topic(db: AsyncSession, topic_id: uuid.UUID) -> Topic | None:
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    return result.scalar_one_or_none()


async def list_topics(db: AsyncSession, book_id: uuid.UUID) -> list[Topic]:
    result = await db.execute(
        select(Topic).where(Topic.book_id == book_id).order_by(Topic.position.asc())
    )
    return list(result.scalars().all())


async def update_topic(
    db: AsyncSession,
    topic: Topic,
    title: str | None = None,
    video_url: str | None = None,
    image_url: str | None = None,
) -> Topic:
    if title is not None:
        topic.title = title
    if video_url is not None:
        validate_url(video_url)
        topic.video_url = video_url
    if image_url is not None:
        validate_url(image_url)
        topic.image_url = image_url

    # Ensure at least one media source remains after update
    if not topic.video_url and not topic.image_url:
        raise ValueError("A topic must have at least a video_url or an image_url")

    await db.commit()
    await db.refresh(topic)
    return topic


async def get_student_progress_count(db: AsyncSession, topic_id: uuid.UUID) -> int:
    """Return number of students who have any progress on this topic."""
    wp_result = await db.execute(
        select(func.count()).where(WatchProgress.topic_id == topic_id)
    )
    qp_result = await db.execute(
        select(func.count()).where(
            and_(QuizProgress.topic_id == topic_id, QuizProgress.is_started == True)  # noqa: E712
        )
    )
    # Return the max of the two counts (a student might have only one or both)
    wp_count = wp_result.scalar() or 0
    qp_count = qp_result.scalar() or 0
    return max(wp_count, qp_count)


async def delete_topic(db: AsyncSession, topic: Topic) -> int:
    """Delete topic. Returns count of affected students for warning display."""
    affected = await get_student_progress_count(db, topic.id)
    await db.delete(topic)
    await db.commit()
    return affected


async def reorder_topics(
    db: AsyncSession,
    book_id: uuid.UUID,
    ordered_ids: list[uuid.UUID],
) -> bool:
    """
    Reassign positions 0, 1, 2, ... to topics in the given order.
    Returns True if any student has progress in this book (warning signal).
    """
    # Verify all IDs belong to this book
    result = await db.execute(
        select(Topic).where(Topic.book_id == book_id)
    )
    existing = {t.id: t for t in result.scalars().all()}

    for topic_id in ordered_ids:
        if topic_id not in existing:
            raise ValueError(f"Topic {topic_id} does not belong to book {book_id}")

    # Check for student progress across all topics in this book (for warning)
    has_student_progress = False
    for t in existing.values():
        count = await get_student_progress_count(db, t.id)
        if count > 0:
            has_student_progress = True
            break

    # Assign positions
    for position, topic_id in enumerate(ordered_ids):
        existing[topic_id].position = position

    # Topics not in ordered_ids get pushed to the end
    next_pos = len(ordered_ids)
    for topic_id, topic in existing.items():
        if topic_id not in ordered_ids:
            topic.position = next_pos
            next_pos += 1

    await db.commit()
    return has_student_progress


# ---------------------------------------------------------------------------
# Topic Notes
# ---------------------------------------------------------------------------


async def get_topic_notes(db: AsyncSession, topic_id: uuid.UUID) -> TopicNotes | None:
    result = await db.execute(
        select(TopicNotes).where(TopicNotes.topic_id == topic_id)
    )
    return result.scalar_one_or_none()


async def topic_has_notes(db: AsyncSession, topic_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(TopicNotes.topic_id).where(TopicNotes.topic_id == topic_id)
    )
    return result.scalar_one_or_none() is not None


async def create_or_update_topic_notes(
    db: AsyncSession,
    topic_id: uuid.UUID,
    author_id: uuid.UUID,
    title: str,
    content: dict,
) -> TopicNotes:
    # Validate topic exists
    topic = await db.execute(select(Topic).where(Topic.id == topic_id))
    if topic.scalar_one_or_none() is None:
        raise ValueError("Topic not found")

    # Validate content size
    content_json = json.dumps(content)
    if len(content_json.encode("utf-8")) > MAX_CONTENT_SIZE:
        raise ValueError(f"Content exceeds maximum size of {MAX_CONTENT_SIZE / (1024 * 1024):.1f}MB")

    cleaned = validate_and_clean_content(content)

    notes = await get_topic_notes(db, topic_id)
    if notes:
        notes.title = title
        notes.content = cleaned
        notes.updated_at = datetime.now(timezone.utc)
    else:
        notes = TopicNotes(
            topic_id=topic_id,
            author_id=author_id,
            title=title,
            content=cleaned,
        )
        db.add(notes)

    await db.commit()
    await db.refresh(notes)
    return notes


async def delete_topic_notes(db: AsyncSession, notes: TopicNotes) -> None:
    await db.delete(notes)
    await db.commit()
