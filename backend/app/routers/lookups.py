import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_tutor
from app.schemas.lookup import (
    LookupOptions,
    SectionCreate,
    SectionOut,
    SectionUpdate,
    StandardCreate,
    StandardOut,
    StandardUpdate,
)
from app.services.lookup import (
    create_section,
    create_standard,
    delete_section,
    delete_standard,
    get_lookup_options,
    get_section,
    get_standard,
    list_sections,
    list_standards,
    update_section,
    update_standard,
)

router = APIRouter(prefix="/api/lookups", tags=["lookups"])


# ============================================================================
# PUBLIC — dropdown options (any authenticated user)
# ============================================================================

@router.get("/options", response_model=LookupOptions)
async def get_options(request: Request, db: AsyncSession = Depends(get_db)):
    get_current_user(request)
    return await get_lookup_options(db)


# ============================================================================
# STANDARDS CRUD (tutor only)
# ============================================================================

@router.get("/standards", response_model=list[StandardOut])
async def list_standards_endpoint(request: Request, db: AsyncSession = Depends(get_db)):
    require_tutor(request)
    return await list_standards(db)


@router.post("/standards", response_model=StandardOut, status_code=status.HTTP_201_CREATED)
async def create_standard_endpoint(body: StandardCreate, request: Request, db: AsyncSession = Depends(get_db)):
    require_tutor(request)
    try:
        std = await create_standard(db, name=body.name, display_order=body.display_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return StandardOut(
        id=str(std.id),
        name=std.name,
        display_order=std.display_order,
        student_count=0,
        book_count=0,
        created_at=std.created_at,
        updated_at=std.updated_at,
    )


@router.put("/standards/{standard_id}", response_model=StandardOut)
async def update_standard_endpoint(
    standard_id: uuid.UUID, body: StandardUpdate, request: Request, db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    std = await get_standard(db, standard_id)
    if not std:
        raise HTTPException(status_code=404, detail="Standard not found")
    try:
        std = await update_standard(db, std, name=body.name, display_order=body.display_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Re-query to get counts
    items = await list_standards(db)
    for item in items:
        if item["id"] == str(std.id):
            return StandardOut(**item)

    return StandardOut(
        id=str(std.id), name=std.name, display_order=std.display_order,
        created_at=std.created_at, updated_at=std.updated_at,
    )


@router.delete("/standards/{standard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_standard_endpoint(
    standard_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    std = await get_standard(db, standard_id)
    if not std:
        raise HTTPException(status_code=404, detail="Standard not found")
    try:
        await delete_standard(db, std)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


# ============================================================================
# SECTIONS CRUD (tutor only)
# ============================================================================

@router.get("/sections", response_model=list[SectionOut])
async def list_sections_endpoint(request: Request, db: AsyncSession = Depends(get_db)):
    require_tutor(request)
    return await list_sections(db)


@router.post("/sections", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
async def create_section_endpoint(body: SectionCreate, request: Request, db: AsyncSession = Depends(get_db)):
    require_tutor(request)
    try:
        sec = await create_section(db, name=body.name, display_order=body.display_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return SectionOut(
        id=str(sec.id),
        name=sec.name,
        display_order=sec.display_order,
        student_count=0,
        created_at=sec.created_at,
        updated_at=sec.updated_at,
    )


@router.put("/sections/{section_id}", response_model=SectionOut)
async def update_section_endpoint(
    section_id: uuid.UUID, body: SectionUpdate, request: Request, db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    sec = await get_section(db, section_id)
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    try:
        sec = await update_section(db, sec, name=body.name, display_order=body.display_order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    items = await list_sections(db)
    for item in items:
        if item["id"] == str(sec.id):
            return SectionOut(**item)

    return SectionOut(
        id=str(sec.id), name=sec.name, display_order=sec.display_order,
        created_at=sec.created_at, updated_at=sec.updated_at,
    )


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section_endpoint(
    section_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    sec = await get_section(db, section_id)
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    try:
        await delete_section(db, sec)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
