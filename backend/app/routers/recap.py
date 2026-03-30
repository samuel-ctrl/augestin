import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_student, require_tutor
from app.schemas.recap import RecapCreate, RecapOut, RecapUpdate
from app.services.recap import (
    create_or_update_recap,
    delete_recap,
    get_recap,
)

router = APIRouter(tags=["recap"])


@router.get("/api/books/{book_id}/recap", response_model=RecapOut | None)
async def get_recap_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get recap for a book. Tutor and student can read."""
    # Allow both tutor and student
    user = None
    try:
        user = require_student(request)
    except HTTPException:
        try:
            user = require_tutor(request)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )

    recap = await get_recap(db, book_id)
    if recap is None:
        return None

    return RecapOut(
        id=str(recap.id),
        book_id=str(recap.book_id),
        created_by=str(recap.author_id),
        title=recap.title,
        content=recap.content,
        created_at=recap.created_at,
        updated_at=recap.updated_at,
    )


@router.post("/api/books/{book_id}/recap", response_model=RecapOut, status_code=status.HTTP_201_CREATED)
async def create_or_update_recap_endpoint(
    book_id: uuid.UUID,
    body: RecapCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create or update recap for a book. Tutor only."""
    tutor = require_tutor(request)

    try:
        recap = await create_or_update_recap(
            db,
            book_id=book_id,
            created_by=tutor.id,
            title=body.title,
            content=body.content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return RecapOut(
        id=str(recap.id),
        book_id=str(recap.book_id),
        created_by=str(recap.author_id),
        title=recap.title,
        content=recap.content,
        created_at=recap.created_at,
        updated_at=recap.updated_at,
    )


@router.put("/api/books/{book_id}/recap", response_model=RecapOut)
async def update_recap_endpoint(
    book_id: uuid.UUID,
    body: RecapUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update recap for a book. Tutor only."""
    tutor = require_tutor(request)

    recap = await get_recap(db, book_id)
    if recap is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recap not found"
        )

    # Ensure tutor owns the recap
    if recap.author_id != tutor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this recap"
        )

    try:
        recap = await create_or_update_recap(
            db,
            book_id=book_id,
            created_by=tutor.id,
            title=body.title or recap.title,
            content=body.content or recap.content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return RecapOut(
        id=str(recap.id),
        book_id=str(recap.book_id),
        created_by=str(recap.author_id),
        title=recap.title,
        content=recap.content,
        created_at=recap.created_at,
        updated_at=recap.updated_at,
    )


@router.delete("/api/books/{book_id}/recap", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recap_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete recap for a book. Tutor only."""
    tutor = require_tutor(request)

    recap = await get_recap(db, book_id)
    if recap is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recap not found"
        )

    # Ensure tutor owns the recap
    if recap.author_id != tutor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this recap"
        )

    await delete_recap(db, recap)
