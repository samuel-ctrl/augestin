import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_tutor
from app.schemas.assignment import AssignmentOut, AssignRequest
from app.schemas.pagination import PaginatedResponse
from app.services.assignment import assign_book, delete_assignment, list_assignments_by_book

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def assign_book_endpoint(
    body: AssignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)
    student_uuids = [uuid.UUID(sid) for sid in body.student_ids]
    created = await assign_book(db, book_id=uuid.UUID(body.book_id), student_ids=student_uuids, tutor_id=tutor.id)
    return {"detail": f"Assigned to {created} student(s)", "created": created}


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment_endpoint(
    assignment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    success = await delete_assignment(db, assignment_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")


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
