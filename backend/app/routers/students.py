import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_tutor
from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.user import User
from app.models.watch_progress import WatchProgress
from app.schemas.pagination import PaginatedResponse
from app.schemas.user import (
    BookProgressOut,
    ResetPasswordResponse,
    StudentCreate,
    StudentCreateResponse,
    StudentOut,
    StudentUpdate,
)
from app.services.student import (
    create_student,
    delete_student,
    get_student,
    list_students,
    reset_password,
    update_student,
)

router = APIRouter(prefix="/api/students", tags=["students"])


async def _student_to_out(db: AsyncSession, student: User) -> StudentOut:
    count_q = select(func.count()).where(BookAssignment.student_id == student.id)
    assignment_count = (await db.execute(count_q)).scalar() or 0
    return StudentOut(
        id=str(student.id),
        login_id=student.login_id,
        name=student.name,
        email=student.email,
        phone=student.phone,
        standard=student.standard,
        must_change_password=student.must_change_password,
        assignment_count=assignment_count,
        created_at=student.created_at,
        updated_at=student.updated_at,
    )


@router.get("/", response_model=PaginatedResponse[StudentOut])
async def list_students_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    standard: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    students, total, pg, ps, total_pages = await list_students(
        db, page=page, page_size=page_size, search=search,
        sort_by=sort_by, sort_order=sort_order, standard=standard,
    )
    items = []
    for s in students:
        items.append(await _student_to_out(db, s))
    return PaginatedResponse(
        items=items, total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post("/", response_model=StudentCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_student_endpoint(
    body: StudentCreate,
    db: AsyncSession = Depends(get_db),
    tutor: User = Depends(require_tutor),
):
    try:
        student, plain_password = await create_student(
            db,
            name=body.name,
            tutor_id=tutor.id,
            email=body.email,
            phone=body.phone,
            standard=body.standard,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return StudentCreateResponse(
        id=str(student.id),
        login_id=student.login_id,
        name=student.name,
        password=plain_password,
    )


@router.get("/{student_id}", response_model=StudentOut)
async def get_student_endpoint(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    student = await get_student(db, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return await _student_to_out(db, student)


@router.put("/{student_id}", response_model=StudentOut)
async def update_student_endpoint(
    student_id: uuid.UUID,
    body: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    student = await get_student(db, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    try:
        student = await update_student(
            db, student,
            name=body.name, email=body.email,
            phone=body.phone, standard=body.standard,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return await _student_to_out(db, student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_endpoint(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    student = await get_student(db, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    await delete_student(db, student)


@router.post("/{student_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password_endpoint(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    student = await get_student(db, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    plain_password = await reset_password(db, student)
    return ResetPasswordResponse(login_id=student.login_id, password=plain_password)


@router.get("/{student_id}/progress", response_model=PaginatedResponse[BookProgressOut])
async def get_student_progress(
    student_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("last_watched_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    student = await get_student(db, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    query = (
        select(WatchProgress, Book)
        .join(Book, WatchProgress.book_id == Book.id)
        .where(WatchProgress.student_id == student_id)
    )

    count_q = select(func.count()).select_from(
        select(WatchProgress).where(WatchProgress.student_id == student_id).subquery()
    )
    total = (await db.execute(count_q)).scalar() or 0

    allowed = {"last_watched_at", "watch_percentage", "completed"}
    if sort_by not in allowed:
        sort_by = "last_watched_at"
    sort_col = getattr(WatchProgress, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    items = [
        BookProgressOut(
            book_id=str(book.id),
            book_title=book.title,
            subject_id=str(book.subject_id),
            watch_percentage=wp.watch_percentage,
            last_position_seconds=wp.last_position_seconds,
            completed=wp.completed,
            last_watched_at=wp.last_watched_at.isoformat() if wp.last_watched_at else None,
        )
        for wp, book in rows
    ]

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages,
    )
