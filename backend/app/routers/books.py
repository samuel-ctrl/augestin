import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func as sa_func

from app.dependencies import get_current_user, get_db, require_tutor
from app.models.question import Question
from app.models.user import User, UserType
from app.models.watch_progress import WatchProgress
from app.schemas.book import BookOut
from app.schemas.pagination import PaginatedResponse
from app.services.book import (
    create_book,
    delete_book,
    get_book,
    list_books,
    save_upload,
    update_book,
    validate_thumbnail_file,
    validate_video_file,
)
from app.services.subject import get_subject

router = APIRouter(tags=["books"])


def _book_to_out(book, progress=None, question_count: int = 0) -> BookOut:
    out = BookOut(
        id=str(book.id),
        title=book.title,
        description=book.description,
        thumbnail_url=book.thumbnail_url,
        video_url=book.video_url,
        video_duration_seconds=book.video_duration_seconds,
        standard=book.standard,
        sort_order=book.sort_order,
        subject_id=str(book.subject_id),
        created_by=book.created_by,
        created_at=book.created_at,
        updated_at=book.updated_at,
        question_count=question_count,
    )
    if progress:
        out.watch_percentage = progress.watch_percentage
        out.last_position_seconds = progress.last_position_seconds
        out.completed = progress.completed
    return out


# --- /api/subjects/{subject_id}/books ---

@router.get("/api/subjects/{subject_id}/books", response_model=PaginatedResponse[BookOut])
async def list_books_endpoint(
    subject_id: uuid.UUID,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("sort_order"),
    sort_order: str = Query("asc"),
    standard: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    current_user = get_current_user(request)
    subject = await get_subject(db, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    items_data, total, pg, ps, total_pages = await list_books(
        db, subject_id=subject_id, user=current_user,
        page=page, page_size=page_size, search=search,
        sort_by=sort_by, sort_order=sort_order, standard=standard,
    )
    # Fetch question counts for all books in one query
    book_ids = [d["book"].id for d in items_data]
    q_counts: dict = {}
    if book_ids:
        count_result = await db.execute(
            select(Question.book_id, sa_func.count(Question.id))
            .where(Question.book_id.in_(book_ids))
            .group_by(Question.book_id)
        )
        q_counts = dict(count_result.all())
    items = [
        _book_to_out(d["book"], d["progress"], question_count=q_counts.get(d["book"].id, 0))
        for d in items_data
    ]
    return PaginatedResponse(
        items=items, total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post("/api/subjects/{subject_id}/books", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def create_book_endpoint(
    subject_id: uuid.UUID,
    request: Request,
    title: str = Form(...),
    standard: str = Form(...),
    video: UploadFile = File(...),
    description: str | None = Form(None),
    sort_order: int = Form(0),
    video_duration_seconds: float | None = Form(None),
    thumbnail: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    subject = await get_subject(db, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    # Read and validate video
    video_content = await video.read()
    try:
        video_ext = validate_video_file(video.filename or "video.mp4", len(video_content))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    video_url = await save_upload(video_content, "videos", video_ext)

    # Read and validate thumbnail (optional)
    thumbnail_url = None
    if thumbnail and thumbnail.filename:
        thumb_content = await thumbnail.read()
        try:
            thumb_ext = validate_thumbnail_file(thumbnail.filename, len(thumb_content))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        thumbnail_url = await save_upload(thumb_content, "thumbnails", thumb_ext)

    try:
        book = await create_book(
            db, title=title, subject_id=subject_id,
            video_url=video_url, standard=standard, description=description,
            thumbnail_url=thumbnail_url, video_duration_seconds=video_duration_seconds,
            sort_order=sort_order,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _book_to_out(book)


# --- /api/books/{id} ---

@router.get("/api/books/{book_id}", response_model=BookOut)
async def get_book_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user: User = get_current_user(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    progress = None
    if current_user.user_type == UserType.student:
        # Verify assignment exists
        from app.models.book_assignment import BookAssignment
        assignment_result = await db.execute(
            select(BookAssignment).where(
                BookAssignment.book_id == book_id,
                BookAssignment.student_id == current_user.id,
            )
        )
        if assignment_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Book not assigned to you")

        wp_result = await db.execute(
            select(WatchProgress).where(
                WatchProgress.student_id == current_user.id,
                WatchProgress.book_id == book_id,
            )
        )
        progress = wp_result.scalar_one_or_none()

    # Get question count
    qc_result = await db.execute(
        select(sa_func.count(Question.id)).where(Question.book_id == book_id)
    )
    question_count = qc_result.scalar() or 0

    return _book_to_out(book, progress, question_count=question_count)


@router.put("/api/books/{book_id}", response_model=BookOut)
async def update_book_endpoint(
    book_id: uuid.UUID,
    request: Request,
    title: str | None = Form(None),
    description: str | None = Form(None),
    standard: str | None = Form(None),
    sort_order: int | None = Form(None),
    video_duration_seconds: float | None = Form(None),
    video: UploadFile | None = File(None),
    thumbnail: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    new_video_url = None
    if video and video.filename:
        video_content = await video.read()
        try:
            video_ext = validate_video_file(video.filename, len(video_content))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        new_video_url = await save_upload(video_content, "videos", video_ext)

    new_thumbnail_url = None
    if thumbnail and thumbnail.filename:
        thumb_content = await thumbnail.read()
        try:
            thumb_ext = validate_thumbnail_file(thumbnail.filename, len(thumb_content))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        new_thumbnail_url = await save_upload(thumb_content, "thumbnails", thumb_ext)

    try:
        book = await update_book(
            db, book, title=title, description=description, standard=standard,
            sort_order=sort_order, video_url=new_video_url, thumbnail_url=new_thumbnail_url,
            video_duration_seconds=video_duration_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _book_to_out(book)


@router.delete("/api/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    await delete_book(db, book)
