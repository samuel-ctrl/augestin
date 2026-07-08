import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_student, require_tutor
from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.subject import Subject
from app.models.user import User, UserType
from app.schemas.book import BookCreateRequest, BookOut, BookUpdateRequest
from app.schemas.book_recap import BookRecapCreate, BookRecapOut
from app.schemas.pagination import PaginatedResponse
from app.services.book import (
    create_book,
    delete_book,
    get_book,
    get_topic_counts,
    list_books,
    update_book,
)
from app.services.book_recap import create_or_update_book_recap, get_book_recap
from app.services.subject import get_subject

router = APIRouter(tags=["books"])


async def _require_book_assigned(db: AsyncSession, book_id: uuid.UUID, student_id: uuid.UUID) -> None:
    result = await db.execute(
        select(BookAssignment).where(
            BookAssignment.book_id == book_id, BookAssignment.student_id == student_id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Book not assigned to you")


def _book_recap_to_out(recap) -> BookRecapOut:
    return BookRecapOut(
        id=str(recap.id),
        book_id=str(recap.book_id),
        student_id=str(recap.student_id),
        title=recap.title,
        content=recap.content,
        created_at=recap.created_at,
        updated_at=recap.updated_at,
    )


def _book_to_out(book, topic_count: int = 0) -> BookOut:
    return BookOut(
        id=str(book.id),
        title=book.title,
        description=book.description,
        thumbnail_url=book.thumbnail_url,
        standard=book.standard,
        subject_id=str(book.subject_id),
        created_by=book.created_by,
        created_at=book.created_at,
        updated_at=book.updated_at,
        topic_count=topic_count,
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
    book_ids = [b.id for b in items_data]
    topic_counts = await get_topic_counts(db, book_ids)
    items = [
        _book_to_out(b, topic_count=topic_counts.get(b.id, 0))
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
            standard=body.standard,
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
        assignment_result = await db.execute(
            select(BookAssignment).where(
                BookAssignment.book_id == book_id,
                BookAssignment.student_id == current_user.id,
            )
        )
        if assignment_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Book not assigned to you")

    topic_counts = await get_topic_counts(db, [book_id])
    return _book_to_out(book, topic_count=topic_counts.get(book_id, 0))


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
            db, book, title=body.title, description=body.description,
            standard=body.standard, thumbnail_url=body.thumbnail_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    topic_counts = await get_topic_counts(db, [book_id])
    return _book_to_out(book, topic_count=topic_counts.get(book_id, 0))


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
    """List books assigned to the current student with topic counts."""
    student = require_student(request)

    query = (
        select(Book)
        .join(BookAssignment, Book.id == BookAssignment.book_id)
        .where(BookAssignment.student_id == student.id)
        .order_by(Book.created_at.desc())
    )
    results = list((await db.execute(query)).scalars().all())

    book_ids = [b.id for b in results]
    topic_counts = await get_topic_counts(db, book_ids)

    items = [
        {
            "id": str(book.id),
            "title": book.title,
            "description": book.description,
            "thumbnail_url": book.thumbnail_url,
            "standard": book.standard,
            "subject_id": str(book.subject_id),
            "topic_count": topic_counts.get(book.id, 0),
        }
        for book in results
    ]
    return {"items": items}


# --- /api/students/books/quizzes ---

@router.get("/api/students/books/quizzes")
async def list_student_book_quizzes(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """List assigned books that have quiz questions across topics."""
    student = require_student(request)

    query = (
        select(Book)
        .join(BookAssignment, Book.id == BookAssignment.book_id)
        .where(BookAssignment.student_id == student.id)
        .order_by(Book.created_at.asc())
    )
    results = list((await db.execute(query)).scalars().all())

    book_ids = [b.id for b in results]

    # Count questions per book via topics
    from sqlalchemy import func
    from app.models.topic import Topic
    from app.models.question import Question

    q_count_result = await db.execute(
        select(Topic.book_id, func.count(Question.id))
        .join(Question, Question.topic_id == Topic.id)
        .where(Topic.book_id.in_(book_ids))
        .group_by(Topic.book_id)
    )
    q_counts = dict(q_count_result.all())

    subject_ids = list({b.subject_id for b in results})
    subject_names: dict = {}
    if subject_ids:
        subj_result = await db.execute(
            select(Subject).where(Subject.id.in_(subject_ids))
        )
        subject_names = {s.id: s.name for s in subj_result.scalars().all()}

    items = []
    for book in results:
        qcount = q_counts.get(book.id, 0)
        if qcount == 0:
            continue
        items.append({
            "book_id": str(book.id),
            "book_title": book.title,
            "book_thumbnail_url": book.thumbnail_url,
            "subject_id": str(book.subject_id),
            "subject_name": subject_names.get(book.subject_id, ""),
            "question_count": qcount,
            "is_quiz_unlocked": True,  # Topic 0 is always unlocked
        })

    return {"items": items}


# --- /api/books/{id}/recap — a student's own personal recap notes for the book ---

@router.get("/api/books/{book_id}/recap", response_model=BookRecapOut | None)
async def get_book_recap_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    await _require_book_assigned(db, book_id, student.id)

    recap = await get_book_recap(db, book_id, student.id)
    if recap is None:
        return None
    return _book_recap_to_out(recap)


@router.post("/api/books/{book_id}/recap", response_model=BookRecapOut)
async def create_or_update_book_recap_endpoint(
    book_id: uuid.UUID,
    body: BookRecapCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    book = await get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    await _require_book_assigned(db, book_id, student.id)

    try:
        recap = await create_or_update_book_recap(
            db, book_id=book_id, student_id=student.id,
            title=body.title, content=body.content,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _book_recap_to_out(recap)
