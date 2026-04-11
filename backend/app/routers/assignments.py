import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db, require_tutor
from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.schemas.assignment import AssignmentOut, AssignRequest
from app.schemas.pagination import PaginatedResponse
from app.services.assignment import assign_book, delete_assignment, list_assignments_by_book
from app.services.notification_service import create_and_notify

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def assign_book_endpoint(
    body: AssignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)
    book_id = uuid.UUID(body.book_id)
    student_uuids = [uuid.UUID(sid) for sid in body.student_ids]
    created_ids = await assign_book(db, book_id=book_id, student_ids=student_uuids, tutor_id=tutor.id)

    if created_ids:
        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one()
        for sid in created_ids:
            await create_and_notify(
                db, recipient_id=sid, sender_id=tutor.id,
                message=f"{tutor.name} assigned you book: '{book.title}'",
                notification_type="book_assigned", reference_id=book_id,
            )

    return {"detail": f"Assigned to {len(created_ids)} student(s)", "created": len(created_ids)}


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment_endpoint(
    assignment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    # Load assignment with book before deleting so we can notify
    result = await db.execute(
        select(BookAssignment).options(selectinload(BookAssignment.book)).where(BookAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    student_id = assignment.student_id
    book_title = assignment.book.title
    book_id = assignment.book_id

    success = await delete_assignment(db, assignment_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    await create_and_notify(
        db, recipient_id=student_id, sender_id=tutor.id,
        message=f"{tutor.name} unassigned you from book: '{book_title}'",
        notification_type="book_unassigned", reference_id=book_id,
    )


@router.get("/book/{book_id}", response_model=PaginatedResponse[AssignmentOut])
async def list_assignments_endpoint(
    book_id: uuid.UUID,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    rows, total, pg, ps, total_pages = await list_assignments_by_book(
        db, book_id=book_id, page=page, page_size=page_size,
        search=search, sort_by=sort_by, sort_order=sort_order,
    )
    items = [
        AssignmentOut(
            id=str(assignment.id),
            book_id=str(assignment.book_id),
            student_id=str(assignment.student_id),
            student_name=student.name,
            student_login_id=student.login_id,
            assigned_by=str(assignment.assigned_by),
            created_at=assignment.created_at,
        )
        for assignment, student in rows
    ]
    return PaginatedResponse(
        items=items, total=total, page=pg, page_size=ps, total_pages=total_pages,
    )
