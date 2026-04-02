import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_student, require_tutor
from app.models.doubt import Doubt as DoubtModel
from app.models.user import User, UserType
from app.schemas.doubt import (
    DoubtCreate, DoubtUpdate, DoubtStatusUpdate,
    DoubtOut, DoubtDetailOut,
    DoubtCommentCreate, DoubtCommentUpdate, DoubtCommentOut,
)
from app.schemas.pagination import PaginatedResponse
from app.services.doubt import (
    create_doubt, list_doubts, get_doubt, update_doubt, delete_doubt,
    update_doubt_status, create_comment, get_comment, update_comment, delete_comment,
)

router = APIRouter(tags=["doubts"])


# ============================================================================
# DOUBT CRUD
# ============================================================================

@router.get("/api/doubts", response_model=PaginatedResponse[DoubtOut])
async def list_doubts_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    status_filter: str = Query("", alias="status"),
    book_id: str = Query(""),
    my_doubts: bool = Query(False),
):
    user = get_current_user(request)

    student_id = None
    if my_doubts:
        student_id = user.id

    book_uuid = None
    if book_id:
        try:
            book_uuid = uuid.UUID(book_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid book_id")

    items, total, pg, ps, total_pages = await list_doubts(
        db, page=page, page_size=page_size, search=search,
        status_filter=status_filter or None,
        book_id=book_uuid, student_id=student_id,
    )

    return PaginatedResponse(
        items=[DoubtOut(**item) for item in items],
        total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post("/api/doubts", response_model=DoubtOut, status_code=status.HTTP_201_CREATED)
async def create_doubt_endpoint(
    body: DoubtCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)

    book_uuid = None
    if body.book_id:
        try:
            book_uuid = uuid.UUID(body.book_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid book_id")

    try:
        doubt = await create_doubt(
            db, student_id=student.id,
            title=body.title, description=body.description,
            book_id=book_uuid,
            attachment_links=body.attachment_links,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return DoubtOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=student.name,
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=None,
        attachment_links=doubt.attachment_links or [],
        comment_count=0,
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
    )


@router.get("/api/doubts/{doubt_id}", response_model=DoubtDetailOut)
async def get_doubt_endpoint(
    doubt_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    get_current_user(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    comments = [
        DoubtCommentOut(
            id=str(c.id),
            doubt_id=str(c.doubt_id),
            user_id=str(c.user_id),
            user_name=c.user.name if c.user else "",
            user_type=c.user.user_type if c.user else "",
            content=c.content,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in sorted(doubt.comments, key=lambda x: x.created_at)
    ]

    return DoubtDetailOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=doubt.student.name if doubt.student else "",
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=doubt.book.title if doubt.book else None,
        attachment_links=doubt.attachment_links or [],
        comment_count=len(doubt.comments),
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
        comments=comments,
    )


@router.put("/api/doubts/{doubt_id}", response_model=DoubtOut)
async def update_doubt_endpoint(
    doubt_id: uuid.UUID,
    body: DoubtUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    # Students can only edit their own doubts
    if user.user_type == UserType.student and str(doubt.student_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own doubts")

    await update_doubt(db, doubt, title=body.title, description=body.description)

    # Re-fetch with eager-loaded relationships (commit expires them)
    doubt = await get_doubt(db, doubt_id)

    return DoubtOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=doubt.student.name if doubt.student else "",
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=doubt.book.title if doubt.book else None,
        attachment_links=doubt.attachment_links or [],
        comment_count=len(doubt.comments),
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
    )


@router.delete("/api/doubts/{doubt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doubt_endpoint(
    doubt_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    result = await db.execute(select(DoubtModel).where(DoubtModel.id == doubt_id))
    doubt = result.scalar_one_or_none()
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    if user.user_type == UserType.student and str(doubt.student_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only delete your own doubts")

    await delete_doubt(db, doubt)


@router.patch("/api/doubts/{doubt_id}/status", response_model=DoubtOut)
async def update_doubt_status_endpoint(
    doubt_id: uuid.UUID,
    body: DoubtStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    await update_doubt_status(db, doubt, body.status)

    # Re-fetch with eager-loaded relationships (commit expires them)
    doubt = await get_doubt(db, doubt_id)

    return DoubtOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=doubt.student.name if doubt.student else "",
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=doubt.book.title if doubt.book else None,
        attachment_links=doubt.attachment_links or [],
        comment_count=len(doubt.comments),
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
    )


# ============================================================================
# COMMENTS
# ============================================================================

@router.post("/api/doubts/{doubt_id}/comments", response_model=DoubtCommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment_endpoint(
    doubt_id: uuid.UUID,
    body: DoubtCommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    result = await db.execute(select(DoubtModel).where(DoubtModel.id == doubt_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Doubt not found")

    comment = await create_comment(db, doubt_id, user.id, body.content)

    return DoubtCommentOut(
        id=str(comment.id),
        doubt_id=str(comment.doubt_id),
        user_id=str(comment.user_id),
        user_name=user.name,
        user_type=user.user_type,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.put("/api/doubts/{doubt_id}/comments/{comment_id}", response_model=DoubtCommentOut)
async def update_comment_endpoint(
    doubt_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: DoubtCommentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    comment = await get_comment(db, comment_id)
    if not comment or comment.doubt_id != doubt_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if user.user_type == UserType.student and str(comment.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    comment = await update_comment(db, comment, body.content)

    # Resolve the comment author's name (may differ from request user if tutor edits)
    author_result = await db.execute(select(User).where(User.id == comment.user_id))
    author = author_result.scalar_one_or_none()

    return DoubtCommentOut(
        id=str(comment.id),
        doubt_id=str(comment.doubt_id),
        user_id=str(comment.user_id),
        user_name=author.name if author else "",
        user_type=author.user_type if author else "",
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/api/doubts/{doubt_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment_endpoint(
    doubt_id: uuid.UUID,
    comment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    comment = await get_comment(db, comment_id)
    if not comment or comment.doubt_id != doubt_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if user.user_type == UserType.student and str(comment.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    await delete_comment(db, comment)


# ============================================================================
# BOOK-LINKED DOUBTS
# ============================================================================

@router.get("/api/books/{book_id}/doubts", response_model=PaginatedResponse[DoubtOut])
async def list_book_doubts(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    get_current_user(request)

    items, total, pg, ps, total_pages = await list_doubts(
        db, page=page, page_size=page_size, book_id=book_id,
    )

    return PaginatedResponse(
        items=[DoubtOut(**item) for item in items],
        total=total, page=pg, page_size=ps, total_pages=total_pages,
    )
