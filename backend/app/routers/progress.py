import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_student
from app.schemas.progress import ProgressUpdate, ResumeBookOut
from app.services.progress import get_resume_book, upsert_progress

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.put("/{book_id}")
async def update_progress(
    book_id: uuid.UUID,
    body: ProgressUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    try:
        progress = await upsert_progress(
            db,
            student_id=student.id,
            book_id=book_id,
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


@router.get("/resume", response_model=ResumeBookOut | None)
async def resume_book(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    result = await get_resume_book(db, student.id)
    if result is None:
        return None
    return ResumeBookOut(**result)
