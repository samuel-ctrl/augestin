import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func as sa_func

from app.dependencies import get_current_user, get_db, require_student, require_tutor
from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.question import Question
from app.models.quiz_progress import QuizProgress
from app.models.user import User, UserType
from app.schemas.book import BookCreateRequest, BookOut, BookUpdateRequest
from app.schemas.pagination import PaginatedResponse
from app.services.book import (
    create_book,
    delete_book,
    get_book,
    list_books,
    update_book,
)
from app.services.subject import get_subject

router = APIRouter(tags=["books"])


def _book_to_out(book, question_count: int = 0) -> BookOut:
    return BookOut(
        id=str(book.id),
        title=book.title,
        description=book.description,
        thumbnail_url=book.thumbnail_url,
        video_url=book.video_url,
        standard=book.standard,
        subject_id=str(book.subject_id),
        created_by=book.created_by,
        created_at=book.created_at,
        updated_at=book.updated_at,
        question_count=question_count,
    )


# --- /api/subjects/{subject_id}/books ---

@router.get("/api/subjects/{subject_id}/books", response_model=PaginatedResponse[BookOut])
async def list_books_endpoint(
    subject_id: uuid.UUID,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
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
    book_ids = [b.id for b in items_data]
    q_counts: dict = {}
    if book_ids:
        count_result = await db.execute(
            select(Question.book_id, sa_func.count(Question.id))
            .where(Question.book_id.in_(book_ids))
            .group_by(Question.book_id)
        )
        q_counts = dict(count_result.all())
    items = [
        _book_to_out(b, question_count=q_counts.get(b.id, 0))
        for b in items_data
    ]
    return PaginatedResponse(
        items=items, total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post("/api/subjects/{subject_id}/books", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def create_book_endpoint(
    subject_id: uuid.UUID,
    body: BookCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    subject = await get_subject(db, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    try:
        book = await create_book(
            db, title=body.title, subject_id=subject_id,
            video_url=body.video_url, standard=body.standard,
            description=body.description,
            thumbnail_url=body.thumbnail_url,
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

    # Get question count
    qc_result = await db.execute(
        select(sa_func.count(Question.id)).where(Question.book_id == book_id)
    )
    question_count = qc_result.scalar() or 0

    return _book_to_out(book, question_count=question_count)


@router.put("/api/books/{book_id}", response_model=BookOut)
async def update_book_endpoint(
    book_id: uuid.UUID,
    body: BookUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    try:
        book = await update_book(
            db, book, title=body.title, description=body.description, standard=body.standard,
            video_url=body.video_url, thumbnail_url=body.thumbnail_url,
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


# --- /api/students/books ---

@router.get("/api/students/books")
async def list_student_books(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """List books assigned to the current student with quiz progress."""
    student = require_student(request)

    query = (
        select(Book, QuizProgress)
        .join(BookAssignment, Book.id == BookAssignment.book_id)
        .outerjoin(
            QuizProgress,
            and_(
                QuizProgress.book_id == Book.id,
                QuizProgress.quiz_source == "book",
                QuizProgress.student_id == student.id,
            )
        )
        .where(BookAssignment.student_id == student.id)
        .order_by(Book.created_at.desc())
    )

    results = (await db.execute(query)).all()

    # Gather book IDs for question count query
    book_ids = [row[0].id for row in results]
    q_counts: dict = {}
    if book_ids:
        count_result = await db.execute(
            select(Question.book_id, sa_func.count(Question.id))
            .where(Question.book_id.in_(book_ids))
            .group_by(Question.book_id)
        )
        q_counts = dict(count_result.all())

    items = []
    for row in results:
        book = row[0]
        progress = row[1]

        progress_dict = None
        if progress:
            progress_dict = {
                "is_started": progress.is_started,
                "is_completed": progress.is_completed,
                "correct_count": progress.correct_count,
                "skipped_count": progress.skipped_count,
                "total_questions": progress.total_questions,
                "score_percentage": progress.score_percentage,
            }

        items.append({
            "id": str(book.id),
            "title": book.title,
            "description": book.description,
            "thumbnail_url": book.thumbnail_url,
            "standard": book.standard,
            "subject_id": str(book.subject_id),
            "question_count": q_counts.get(book.id, 0),
            "progress": progress_dict,
        })

    return {"items": items}
