import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_student, require_tutor
from app.models.book_assignment import BookAssignment
from app.models.test import BookTest, TestSubmission
from app.models.user import User
from app.schemas.test import (
    BookTestCreate, BookTestUpdate, BookTestOut, TestSubmissionOut,
    TestSubmissionStatus, TestSubmitRequest
)
from app.schemas.pagination import PaginatedResponse
from app.services.test import (
    get_test, create_or_update_test, delete_test, list_submissions,
    toggle_submission, get_my_submission
)

router = APIRouter(tags=["test"])


# ============================================================================
# TUTOR ENDPOINTS
# ============================================================================

@router.get("/api/books/{book_id}/test", response_model=BookTestOut | None)
async def get_book_test(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get test for a book. Tutor or student."""
    # Allow both tutor and student
    user = None
    try:
        user = require_student(request)
    except HTTPException:
        try:
            user = require_tutor(request)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )

    test = await get_test(db, book_id)
    if test is None:
        return None

    return BookTestOut(
        id=str(test.id),
        book_id=str(test.book_id),
        drive_link=test.drive_link,
        instructions=test.instructions,
        created_at=test.created_at,
        updated_at=test.updated_at,
    )


@router.post("/api/books/{book_id}/test", response_model=BookTestOut, status_code=status.HTTP_201_CREATED)
async def create_or_update_book_test(
    book_id: uuid.UUID,
    body: BookTestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create or update test for a book. Tutor only."""
    require_tutor(request)

    try:
        test = await create_or_update_test(
            db,
            book_id=book_id,
            drive_link=body.drive_link,
            instructions=body.instructions,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return BookTestOut(
        id=str(test.id),
        book_id=str(test.book_id),
        drive_link=test.drive_link,
        instructions=test.instructions,
        created_at=test.created_at,
        updated_at=test.updated_at,
    )


@router.delete("/api/books/{book_id}/test", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book_test(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete test for a book. Tutor only."""
    require_tutor(request)

    test = await get_test(db, book_id)
    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")

    await delete_test(db, test)


@router.get("/api/books/{book_id}/test/submissions", response_model=PaginatedResponse[TestSubmissionOut])
async def list_book_test_submissions(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
):
    """List submissions for a test. Tutor only."""
    require_tutor(request)

    # Verify test exists
    test = await get_test(db, book_id)
    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")

    submissions, total, page_num, page_size_num, total_pages = await list_submissions(
        db, test.id, page=page, page_size=page_size, search=search
    )

    items = []
    for submission in submissions:
        # Get student info from the submission or from the query
        student_name = getattr(submission, "_student_name", "")
        student_login_id = getattr(submission, "_student_login_id", "")

        # If not set, fetch from database
        if not student_name:
            result = await db.execute(select(User).where(User.id == submission.student_id))
            user = result.scalar_one_or_none()
            if user:
                student_name = user.name
                student_login_id = user.login_id

        items.append(TestSubmissionOut(
            id=str(submission.id),
            test_id=str(submission.test_id),
            student_id=str(submission.student_id),
            student_name=student_name,
            student_login_id=student_login_id,
            submitted_at=submission.submitted_at,
            submission_link=getattr(submission, "submission_link", None),
            created_at=submission.created_at,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ============================================================================
# STUDENT ENDPOINTS
# ============================================================================

@router.get("/api/books/{book_id}/test/my-submission", response_model=TestSubmissionStatus)
async def get_my_test_submission(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get student's submission status for a test."""
    student = require_student(request)

    # Verify student is assigned to this book
    result = await db.execute(
        select(BookAssignment).where(
            and_(
                BookAssignment.book_id == book_id,
                BookAssignment.student_id == student.id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not assigned to this book")

    # Get test
    test = await get_test(db, book_id)
    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")

    # Get submission
    submission = await get_my_submission(db, test.id, student.id)

    return TestSubmissionStatus(
        has_submitted=submission is not None and submission.submitted_at is not None,
        submitted_at=submission.submitted_at if submission else None,
        submission_link=submission.submission_link if submission else None,
    )


@router.put("/api/books/{book_id}/test/submit", response_model=TestSubmissionStatus)
async def submit_test(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    body: TestSubmitRequest = None,
):
    """Toggle test submission status for student."""
    student = require_student(request)

    # Verify student is assigned to this book
    result = await db.execute(
        select(BookAssignment).where(
            and_(
                BookAssignment.book_id == book_id,
                BookAssignment.student_id == student.id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not assigned to this book")

    # Get test
    test = await get_test(db, book_id)
    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")

    submission_link = body.submission_link if body else None
    submission = await toggle_submission(db, test.id, student.id, submission_link=submission_link)

    return TestSubmissionStatus(
        has_submitted=submission.submitted_at is not None,
        submitted_at=submission.submitted_at,
        submission_link=submission.submission_link,
    )
