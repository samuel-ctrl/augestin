import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_student, require_tutor
from app.models.book_assignment import BookAssignment
from app.models.question import Question
from app.models.topic_notes import TopicNotes
from app.models.user import UserType
from app.schemas.topic import (
    ReorderTopicsRequest,
    TopicCreate,
    TopicNotesCreate,
    TopicNotesOut,
    TopicOut,
    TopicProgressOut,
    TopicUpdate,
)
from app.services.book import get_book
from app.services.progress import mark_topic_watched
from app.services.topic import (
    create_topic,
    create_or_update_topic_notes,
    delete_topic,
    delete_topic_notes,
    get_topic,
    get_topic_notes,
    list_topics,
    reorder_topics,
    update_topic,
)
from app.services.topic_progress import get_topic_progress, get_watch_status

router = APIRouter(tags=["topics"])


def _topic_to_out(topic, has_notes: bool = False, question_count: int = 0) -> TopicOut:
    return TopicOut(
        id=str(topic.id),
        book_id=str(topic.book_id),
        title=topic.title,
        position=topic.position,
        video_url=topic.video_url,
        image_url=topic.image_url,
        has_notes=has_notes,
        question_count=question_count,
        created_at=topic.created_at,
        updated_at=topic.updated_at,
    )


async def _require_book_assigned(db: AsyncSession, book_id: uuid.UUID, student_id: uuid.UUID) -> None:
    ass = await db.execute(
        select(BookAssignment).where(
            and_(BookAssignment.book_id == book_id, BookAssignment.student_id == student_id)
        )
    )
    if ass.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Book not assigned to you")


# ---------------------------------------------------------------------------
# Topic CRUD
# ---------------------------------------------------------------------------


@router.get("/api/books/{book_id}/topics", response_model=list[TopicOut])
async def list_topics_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = get_current_user(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if current_user.user_type == UserType.student:
        await _require_book_assigned(db, book_id, current_user.id)

    topics = await list_topics(db, book_id)
    topic_ids = [t.id for t in topics]

    notes_result = await db.execute(
        select(TopicNotes.topic_id).where(TopicNotes.topic_id.in_(topic_ids))
    )
    has_notes_set = set(notes_result.scalars().all())

    count_result = await db.execute(
        select(Question.topic_id, func.count(Question.id))
        .where(Question.topic_id.in_(topic_ids))
        .group_by(Question.topic_id)
    )
    q_counts = dict(count_result.all())

    return [
        _topic_to_out(t, has_notes=t.id in has_notes_set, question_count=q_counts.get(t.id, 0))
        for t in topics
    ]


@router.post("/api/books/{book_id}/topics", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
async def create_topic_endpoint(
    book_id: uuid.UUID,
    body: TopicCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    try:
        topic = await create_topic(
            db, book_id=book_id,
            title=body.title,
            video_url=body.video_url,
            image_url=body.image_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _topic_to_out(topic)


@router.get("/api/topics/{topic_id}", response_model=TopicOut)
async def get_topic_endpoint(
    topic_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = get_current_user(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    if current_user.user_type == UserType.student:
        await _require_book_assigned(db, topic.book_id, current_user.id)

    return _topic_to_out(topic)


@router.put("/api/topics/{topic_id}", response_model=TopicOut)
async def update_topic_endpoint(
    topic_id: uuid.UUID,
    body: TopicUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    try:
        topic = await update_topic(db, topic, title=body.title, video_url=body.video_url, image_url=body.image_url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _topic_to_out(topic)


@router.delete("/api/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic_endpoint(
    topic_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    await delete_topic(db, topic)


@router.put("/api/books/{book_id}/topics/reorder")
async def reorder_topics_endpoint(
    book_id: uuid.UUID,
    body: ReorderTopicsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    try:
        has_student_progress = await reorder_topics(
            db, book_id=book_id,
            ordered_ids=[uuid.UUID(tid) for tid in body.topic_ids],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"detail": "Topics reordered", "has_student_progress": has_student_progress}


# ---------------------------------------------------------------------------
# Topic Notes
# ---------------------------------------------------------------------------


@router.get("/api/topics/{topic_id}/notes", response_model=TopicNotesOut | None)
async def get_topic_notes_endpoint(
    topic_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user = get_current_user(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    if current_user.user_type == UserType.student:
        await _require_book_assigned(db, topic.book_id, current_user.id)

    notes = await get_topic_notes(db, topic_id)
    if notes is None:
        return None
    return TopicNotesOut(
        id=str(notes.id),
        topic_id=str(notes.topic_id),
        title=notes.title,
        content=notes.content,
        created_by=str(notes.author_id) if notes.author_id else None,
        created_at=notes.created_at,
        updated_at=notes.updated_at,
    )


@router.post("/api/topics/{topic_id}/notes", response_model=TopicNotesOut)
async def create_or_update_topic_notes_endpoint(
    topic_id: uuid.UUID,
    body: TopicNotesCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    try:
        notes = await create_or_update_topic_notes(
            db, topic_id=topic_id,
            author_id=tutor.id,
            title=body.title,
            content=body.content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return TopicNotesOut(
        id=str(notes.id),
        topic_id=str(notes.topic_id),
        title=notes.title,
        content=notes.content,
        created_by=str(notes.author_id) if notes.author_id else None,
        created_at=notes.created_at,
        updated_at=notes.updated_at,
    )


@router.delete("/api/topics/{topic_id}/notes", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic_notes_endpoint(
    topic_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    notes = await get_topic_notes(db, topic_id)
    if notes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notes not found")
    await delete_topic_notes(db, notes)


# ---------------------------------------------------------------------------
# Student: Topic Progress & Watch
# ---------------------------------------------------------------------------


@router.get("/api/books/{book_id}/topic-progress", response_model=list[TopicProgressOut])
async def get_book_topic_progress(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    await _require_book_assigned(db, book_id, student.id)

    progress_list = await get_topic_progress(db, student_id=student.id, book_id=book_id)
    return [
        TopicProgressOut(
            topic_id=str(p.topic_id),
            topic_title=p.topic_title,
            position=p.position,
            has_video=p.has_video,
            has_image=p.has_image,
            image_url=p.image_url,
            is_unlocked=p.is_unlocked,
            is_complete=p.is_complete,
            video_complete=p.video_complete,
            quiz_complete=p.quiz_complete,
            question_count=p.question_count,
            score_percentage=p.score_percentage,
        )
        for p in progress_list
    ]


@router.get("/api/topics/{topic_id}/watch-status")
async def get_topic_watch_status(
    topic_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    topic = await get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    await _require_book_assigned(db, topic.book_id, student.id)
    return await get_watch_status(db, student_id=student.id, topic_id=topic_id)


@router.post("/api/topics/{topic_id}/mark-watched")
async def mark_topic_watched_endpoint(
    topic_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    try:
        wp = await mark_topic_watched(db, student_id=student.id, topic_id=topic_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return {"is_watched": True, "watch_percentage": wp.watch_percentage}
