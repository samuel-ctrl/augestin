import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_tutor
from app.models.user import User
from app.schemas.pagination import PaginatedResponse
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate
from app.services.subject import (
    create_subject,
    delete_subject,
    get_subject,
    list_subjects,
    update_subject,
)

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


@router.get("/", response_model=PaginatedResponse[SubjectOut])
async def list_subjects_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items_data, total, pg, ps, total_pages = await list_subjects(
        db, user=current_user, page=page, page_size=page_size,
        search=search, sort_by=sort_by, sort_order=sort_order,
    )
    items = [
        SubjectOut(
            id=str(d["subject"].id),
            name=d["subject"].name,
            icon=d["subject"].icon,
            created_by=str(d["subject"].created_by),
            book_count=d["book_count"],
            created_at=d["subject"].created_at,
            updated_at=d["subject"].updated_at,
        )
        for d in items_data
    ]
    return PaginatedResponse(
        items=items, total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.get("/{subject_id}", response_model=SubjectOut)
async def get_subject_endpoint(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    subject = await get_subject(db, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return SubjectOut(
        id=str(subject.id),
        name=subject.name,
        icon=subject.icon,
        created_by=str(subject.created_by),
        created_at=subject.created_at,
        updated_at=subject.updated_at,
    )


@router.post("/", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject_endpoint(
    body: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    tutor: User = Depends(require_tutor),
):
    try:
        subject = await create_subject(db, name=body.name, icon=body.icon, tutor_id=tutor.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return SubjectOut(
        id=str(subject.id),
        name=subject.name,
        icon=subject.icon,
        created_by=str(subject.created_by),
        created_at=subject.created_at,
        updated_at=subject.updated_at,
    )


@router.put("/{subject_id}", response_model=SubjectOut)
async def update_subject_endpoint(
    subject_id: uuid.UUID,
    body: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    subject = await get_subject(db, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    try:
        subject = await update_subject(db, subject, name=body.name, icon=body.icon)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return SubjectOut(
        id=str(subject.id),
        name=subject.name,
        icon=subject.icon,
        created_by=str(subject.created_by),
        created_at=subject.created_at,
        updated_at=subject.updated_at,
    )


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject_endpoint(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _tutor: User = Depends(require_tutor),
):
    subject = await get_subject(db, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    await delete_subject(db, subject)
