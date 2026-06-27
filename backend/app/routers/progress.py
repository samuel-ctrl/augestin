import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_student
from app.schemas.progress import ProgressUpdate, ResumeTopicOut
from app.services.progress import get_resume_topic, upsert_progress

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.put("/{topic_id}")
async def update_progress(
    topic_id: uuid.UUID,
    body: ProgressUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    try:
        progress = await upsert_progress(
            db,
            student_id=student.id,
            topic_id=topic_id,
            watch_percentage=body.watch_percentage,
            last_position_seconds=body.last_position_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {
        "watch_percentage": progress.watch_percentage,
        "last_position_seconds": progress.last_position_seconds,
        "completed": progress.completed,
    }


@router.get("/resume", response_model=ResumeTopicOut | None)
async def resume_topic(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    result = await get_resume_topic(db, student.id)
    if result is None:
        return None
    return ResumeTopicOut(**result)
