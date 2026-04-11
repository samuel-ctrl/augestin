import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_student, require_tutor
from app.models.test_set import TestSet, TestSetFile, TestSetAssignment, TestSetSubmission
from app.models.user import User, UserType
from app.schemas.test_sets import (
    TestSetCreate, TestSetUpdate, TestSetOut, TestSetDetailOut,
    TestSetFileCreate, TestSetFileUpdate, TestSetFileOut,
    TestSetAssignCreate, TestSetAssignOut,
    TestSetSubmissionOut, TestSetSubmissionStatus, TestSetSubmitRequest,
    AssignedTestSetOut,
)
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import create_and_notify
from app.services.test_set import (
    create_test_set, get_test_set, update_test_set, delete_test_set,
    add_file, get_file, update_file, delete_file,
    list_submissions, toggle_submission, get_my_submission,
)

router = APIRouter(tags=["test_sets"])


def _test_set_to_out(ts: TestSet) -> TestSetOut:
    return TestSetOut(
        id=str(ts.id),
        name=ts.name,
        description=ts.description,
        thumbnail_url=ts.thumbnail_url,
        created_by=str(ts.tutor_id),
        file_count=len(ts.files) if ts.files else 0,
        created_at=ts.created_at,
        updated_at=ts.updated_at,
    )


def _test_set_to_detail(ts: TestSet) -> TestSetDetailOut:
    return TestSetDetailOut(
        id=str(ts.id),
        name=ts.name,
        description=ts.description,
        thumbnail_url=ts.thumbnail_url,
        created_by=str(ts.tutor_id),
        file_count=len(ts.files) if ts.files else 0,
        created_at=ts.created_at,
        updated_at=ts.updated_at,
        files=[
            TestSetFileOut(
                id=str(f.id),
                test_set_id=str(f.test_set_id),
                file_name=f.file_name,
                drive_link=f.drive_link,
                instructions=f.instructions,
                created_at=f.created_at,
                updated_at=f.updated_at,
            )
            for f in (ts.files or [])
        ],
    )


def _file_to_out(f: TestSetFile) -> TestSetFileOut:
    return TestSetFileOut(
        id=str(f.id),
        test_set_id=str(f.test_set_id),
        file_name=f.file_name,
        drive_link=f.drive_link,
        instructions=f.instructions,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


# ============================================================================
# TUTOR CRUD ENDPOINTS
# ============================================================================

@router.get("/api/test-sets", response_model=PaginatedResponse[TestSetOut])
async def list_test_sets(
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    require_tutor(request)

    query = select(TestSet)

    if search:
        query = query.where(
            or_(
                TestSet.name.ilike(f"%{search}%"),
                TestSet.description.ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    allowed_sort = {"created_at", "name"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    sort_column = getattr(TestSet, sort_by)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).scalars().all()
    items = [_test_set_to_out(ts) for ts in results]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages,
    )


@router.post("/api/test-sets", response_model=TestSetDetailOut, status_code=status.HTTP_201_CREATED)
async def create_test_set_endpoint(
    body: TestSetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    files_data = [f.model_dump() for f in body.files] if body.files else None
    ts = await create_test_set(
        db, tutor_id=tutor.id,
        name=body.name, description=body.description,
        thumbnail_url=body.thumbnail_url, files=files_data,
    )
    return _test_set_to_detail(ts)


@router.get("/api/test-sets/{test_set_id}", response_model=TestSetDetailOut)
async def get_test_set_endpoint(
    test_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    # Students can only view test sets assigned to them
    if user.user_type == UserType.student:
        result = await db.execute(
            select(TestSetAssignment).where(
                and_(
                    TestSetAssignment.test_set_id == test_set_id,
                    TestSetAssignment.student_id == user.id,
                )
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not assigned to this test set")

    return _test_set_to_detail(ts)


@router.put("/api/test-sets/{test_set_id}", response_model=TestSetDetailOut)
async def update_test_set_endpoint(
    test_set_id: uuid.UUID,
    body: TestSetUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    if str(ts.tutor_id) != str(tutor.id):
        raise HTTPException(status_code=403, detail="You don't have permission to update this test set")

    await update_test_set(db, ts, name=body.name, description=body.description, thumbnail_url=body.thumbnail_url)

    # Re-fetch with selectin-loaded relationships (commit expires them)
    ts = await get_test_set(db, test_set_id)
    return _test_set_to_detail(ts)


@router.delete("/api/test-sets/{test_set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_set_endpoint(
    test_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    if str(ts.tutor_id) != str(tutor.id):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this test set")

    await delete_test_set(db, ts)


# ============================================================================
# FILES SUB-RESOURCE
# ============================================================================

@router.post("/api/test-sets/{test_set_id}/files", response_model=TestSetFileOut, status_code=status.HTTP_201_CREATED)
async def add_file_endpoint(
    test_set_id: uuid.UUID,
    body: TestSetFileCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    f = await add_file(db, test_set_id, body.file_name, body.drive_link, body.instructions)
    return _file_to_out(f)


@router.put("/api/test-sets/{test_set_id}/files/{file_id}", response_model=TestSetFileOut)
async def update_file_endpoint(
    test_set_id: uuid.UUID,
    file_id: uuid.UUID,
    body: TestSetFileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)

    f = await get_file(db, file_id)
    if not f or f.test_set_id != test_set_id:
        raise HTTPException(status_code=404, detail="File not found")

    f = await update_file(db, f, file_name=body.file_name, drive_link=body.drive_link, instructions=body.instructions)
    return _file_to_out(f)


@router.delete("/api/test-sets/{test_set_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file_endpoint(
    test_set_id: uuid.UUID,
    file_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)

    f = await get_file(db, file_id)
    if not f or f.test_set_id != test_set_id:
        raise HTTPException(status_code=404, detail="File not found")
    await delete_file(db, f)


# ============================================================================
# ASSIGNMENTS SUB-RESOURCE
# ============================================================================

@router.get("/api/test-sets/{test_set_id}/assignments", response_model=PaginatedResponse[TestSetAssignOut])
async def list_test_set_assignments(
    test_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
):
    require_tutor(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    query = (
        select(TestSetAssignment, User.name, User.login_id)
        .join(User, TestSetAssignment.student_id == User.id)
        .where(TestSetAssignment.test_set_id == test_set_id)
    )

    if search:
        query = query.where(
            or_(
                User.name.ilike(f"%{search}%"),
                User.login_id.ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).all()

    items = [
        TestSetAssignOut(
            id=str(assign.id),
            test_set_id=str(assign.test_set_id),
            student_id=str(assign.student_id),
            student_name=name,
            student_login_id=login_id,
            created_at=assign.created_at,
        )
        for assign, name, login_id in results
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages,
    )


@router.post("/api/test-sets/{test_set_id}/assignments", response_model=TestSetAssignOut, status_code=status.HTTP_201_CREATED)
async def assign_student(
    test_set_id: uuid.UUID,
    body: TestSetAssignCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    try:
        student_id = uuid.UUID(body.student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid student_id")

    result = await db.execute(select(User).where(User.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    assignment = TestSetAssignment(test_set_id=test_set_id, student_id=student_id)
    db.add(assignment)

    try:
        await db.commit()
        await db.refresh(assignment)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Student already assigned to this test set")

    await create_and_notify(
        db, recipient_id=student_id, sender_id=tutor.id,
        message=f"You have been assigned a new test set: '{ts.name}'",
        notification_type="test_set_assigned", reference_id=test_set_id,
    )

    return TestSetAssignOut(
        id=str(assignment.id),
        test_set_id=str(assignment.test_set_id),
        student_id=str(assignment.student_id),
        student_name=student.name,
        student_login_id=student.login_id,
        created_at=assignment.created_at,
    )


@router.delete("/api/test-sets/{test_set_id}/assignments/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_student(
    test_set_id: uuid.UUID,
    student_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    result = await db.execute(
        select(TestSetAssignment).where(
            and_(
                TestSetAssignment.test_set_id == test_set_id,
                TestSetAssignment.student_id == student_id,
            )
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    ts = await get_test_set(db, test_set_id)

    await db.delete(assignment)
    await db.commit()

    await create_and_notify(
        db, recipient_id=student_id, sender_id=tutor.id,
        message=f"You have been unassigned from test set: '{ts.name}'",
        notification_type="test_set_unassigned", reference_id=test_set_id,
    )


# ============================================================================
# SUBMISSIONS
# ============================================================================

@router.get("/api/test-sets/{test_set_id}/submissions", response_model=PaginatedResponse[TestSetSubmissionOut])
async def list_test_set_submissions(
    test_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
):
    require_tutor(request)

    ts = await get_test_set(db, test_set_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Test set not found")

    submissions, total, pg, ps, total_pages = await list_submissions(
        db, test_set_id, page=page, page_size=page_size, search=search,
    )

    items = []
    for sub in submissions:
        student_name = getattr(sub, "_student_name", "")
        student_login_id = getattr(sub, "_student_login_id", "")

        if not student_name:
            result = await db.execute(select(User).where(User.id == sub.student_id))
            user = result.scalar_one_or_none()
            if user:
                student_name = user.name
                student_login_id = user.login_id

        items.append(TestSetSubmissionOut(
            id=str(sub.id),
            test_set_id=str(sub.test_set_id),
            student_id=str(sub.student_id),
            student_name=student_name,
            student_login_id=student_login_id,
            submitted_at=sub.submitted_at,
            submission_link=sub.submission_link,
            created_at=sub.created_at,
        ))

    return PaginatedResponse(
        items=items, total=total, page=pg,
        page_size=ps, total_pages=total_pages,
    )


# ============================================================================
# STUDENT ENDPOINTS
# ============================================================================

@router.get("/api/students/test-sets", response_model=list[AssignedTestSetOut])
async def list_student_test_sets(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)

    query = (
        select(TestSet, TestSetSubmission)
        .join(TestSetAssignment, TestSet.id == TestSetAssignment.test_set_id)
        .outerjoin(
            TestSetSubmission,
            and_(
                TestSetSubmission.test_set_id == TestSet.id,
                TestSetSubmission.student_id == student.id,
            )
        )
        .where(TestSetAssignment.student_id == student.id)
        .order_by(TestSet.created_at.desc())
    )

    results = (await db.execute(query)).all()

    items = []
    for ts, submission in results:
        sub_status = None
        if submission:
            sub_status = TestSetSubmissionStatus(
                has_submitted=submission.submitted_at is not None,
                submitted_at=submission.submitted_at,
            )

        items.append(AssignedTestSetOut(
            id=str(ts.id),
            name=ts.name,
            description=ts.description,
            thumbnail_url=ts.thumbnail_url,
            file_count=len(ts.files) if ts.files else 0,
            files=[
                TestSetFileOut(
                    id=str(f.id),
                    test_set_id=str(f.test_set_id),
                    file_name=f.file_name,
                    drive_link=f.drive_link,
                    instructions=f.instructions,
                    created_at=f.created_at,
                    updated_at=f.updated_at,
                )
                for f in (ts.files or [])
            ],
            submission_status=sub_status,
        ))

    return items


@router.get("/api/test-sets/{test_set_id}/my-submission", response_model=TestSetSubmissionStatus)
async def get_my_test_set_submission(
    test_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)

    # Verify assignment
    result = await db.execute(
        select(TestSetAssignment).where(
            and_(
                TestSetAssignment.test_set_id == test_set_id,
                TestSetAssignment.student_id == student.id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not assigned to this test set")

    submission = await get_my_submission(db, test_set_id, student.id)

    return TestSetSubmissionStatus(
        has_submitted=submission is not None and submission.submitted_at is not None,
        submitted_at=submission.submitted_at if submission else None,
        submission_link=submission.submission_link if submission else None,
    )


@router.put("/api/test-sets/{test_set_id}/submit", response_model=TestSetSubmissionStatus)
async def submit_test_set(
    test_set_id: uuid.UUID,
    request: Request,
    body: TestSetSubmitRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)

    # Verify assignment
    result = await db.execute(
        select(TestSetAssignment).where(
            and_(
                TestSetAssignment.test_set_id == test_set_id,
                TestSetAssignment.student_id == student.id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not assigned to this test set")

    submission_link = body.submission_link if body else None
    submission = await toggle_submission(db, test_set_id, student.id, submission_link=submission_link)

    return TestSetSubmissionStatus(
        has_submitted=submission.submitted_at is not None,
        submitted_at=submission.submitted_at,
        submission_link=submission.submission_link,
    )
