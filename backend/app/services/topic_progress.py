"""
Topic progress and unlock computation.

All queries are batched — no N+1. The unlock chain is computed in Python
after two batch fetches (WatchProgress + QuizProgress) and one count query.
"""
import uuid
from dataclasses import dataclass

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.quiz_progress import QuizProgress
from app.models.topic import Topic
from app.models.watch_progress import WatchProgress


@dataclass
class TopicProgressData:
    topic_id: uuid.UUID
    topic_title: str
    position: int
    has_video: bool
    has_image: bool
    is_unlocked: bool
    is_complete: bool
    video_complete: bool
    quiz_complete: bool
    question_count: int
    score_percentage: float | None


async def get_topic_progress(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
) -> list[TopicProgressData]:
    """
    Return per-topic unlock/completion state for a student.
    Uses 4 queries total regardless of topic count.
    """
    # 1. Fetch topics ordered by position
    topics_result = await db.execute(
        select(Topic).where(Topic.book_id == book_id).order_by(Topic.position.asc())
    )
    topics = list(topics_result.scalars().all())

    if not topics:
        return []

    topic_ids = [t.id for t in topics]

    # 2. Batch fetch watch progress for all topics
    wp_result = await db.execute(
        select(WatchProgress).where(
            and_(
                WatchProgress.student_id == student_id,
                WatchProgress.topic_id.in_(topic_ids),
            )
        )
    )
    wp_map: dict[uuid.UUID, WatchProgress] = {wp.topic_id: wp for wp in wp_result.scalars().all()}

    # 3. Batch fetch quiz progress for all topics
    qp_result = await db.execute(
        select(QuizProgress).where(
            and_(
                QuizProgress.student_id == student_id,
                QuizProgress.quiz_source == "topic",
                QuizProgress.topic_id.in_(topic_ids),
            )
        )
    )
    qp_map: dict[uuid.UUID, QuizProgress] = {qp.topic_id: qp for qp in qp_result.scalars().all()}

    # 4. Batch count questions per topic
    count_result = await db.execute(
        select(Question.topic_id, func.count(Question.id))
        .where(Question.topic_id.in_(topic_ids))
        .group_by(Question.topic_id)
    )
    q_count_map: dict[uuid.UUID, int] = dict(count_result.all())

    # 5. Compute completion and unlock in Python
    progress_list: list[TopicProgressData] = []
    prev_complete = True  # topic[0] is always unlocked

    for topic in topics:
        wp = wp_map.get(topic.id)
        qp = qp_map.get(topic.id)
        q_count = q_count_map.get(topic.id, 0)

        has_video = bool(topic.video_url)
        has_image = bool(topic.image_url)

        video_complete = (not has_video) or (wp is not None and wp.completed)
        quiz_complete = (q_count == 0) or (qp is not None and qp.is_completed)
        is_complete = video_complete and quiz_complete
        is_unlocked = prev_complete

        progress_list.append(TopicProgressData(
            topic_id=topic.id,
            topic_title=topic.title,
            position=topic.position,
            has_video=has_video,
            has_image=has_image,
            is_unlocked=is_unlocked,
            is_complete=is_complete,
            video_complete=video_complete,
            quiz_complete=quiz_complete,
            question_count=q_count,
            score_percentage=(qp.score_percentage if qp else None),
        ))

        prev_complete = is_complete

    return progress_list


async def is_test_unlocked(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
) -> bool:
    """
    Test is unlocked only when:
    - Book has at least 1 topic, AND
    - All topics are complete for this student
    """
    progress = await get_topic_progress(db, student_id, book_id)
    if not progress:
        return False  # No topics → test locked
    return all(p.is_complete for p in progress)


async def get_watch_status(
    db: AsyncSession,
    student_id: uuid.UUID,
    topic_id: uuid.UUID,
) -> dict:
    result = await db.execute(
        select(WatchProgress).where(
            and_(
                WatchProgress.student_id == student_id,
                WatchProgress.topic_id == topic_id,
            )
        )
    )
    wp = result.scalar_one_or_none()
    if wp is None:
        return {"is_watched": False, "watch_percentage": 0.0, "last_position_seconds": 0.0}
    return {
        "is_watched": wp.completed,
        "watch_percentage": wp.watch_percentage,
        "last_position_seconds": wp.last_position_seconds,
    }
