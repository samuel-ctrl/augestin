import uuid
from datetime import datetime, timezone

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.test import BookTest, TestSubmission
from app.models.user import User


async def get_test(
    db: AsyncSession,
    book_id: uuid.UUID,
) -> BookTest | None:
    """Get test for a book."""
    result = await db.execute(
        select(BookTest).where(BookTest.book_id == book_id)
    )
    return result.scalar_one_or_none()


async def create_or_update_test(
    db: AsyncSession,
    book_id: uuid.UUID,
    drive_link: str,
    instructions: str | None = None,
) -> BookTest:
    """Create or update a test for a book."""
    # Validate book exists
    result = await db.execute(select(Book).where(Book.id == book_id))
    if result.scalar_one_or_none() is None:
        raise ValueError("Book not found")

    # Check if test already exists
    result = await db.execute(
        select(BookTest).where(BookTest.book_id == book_id)
    )
    test = result.scalar_one_or_none()

    if test:
        # Update existing
        test.drive_link = drive_link
        test.instructions = instructions
        test.updated_at = datetime.now(timezone.utc)
    else:
        # Create new
        test = BookTest(
            book_id=book_id,
            drive_link=drive_link,
            instructions=instructions,
        )
        db.add(test)

    await db.commit()
    await db.refresh(test)
    return test


async def delete_test(
    db: AsyncSession,
    test: BookTest,
) -> None:
    """Delete a test."""
    await db.delete(test)
    await db.commit()


async def list_submissions(
    db: AsyncSession,
    test_id: uuid.UUID,
    page: int,
    page_size: int,
    search: str = "",
) -> tuple[list[TestSubmission], int, int, int, int]:
    """List submissions for a test, paginated.

    Returns all assigned students with their submission state.
    """
    from app.models.book_assignment import BookAssignment

    # Get the book_id from the test
    result = await db.execute(select(BookTest).where(BookTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        return [], 0, page, page_size, 0

    # Query: BookAssignment -> User, left join TestSubmission
    query = (
        select(BookAssignment, User, TestSubmission)
        .join(User, BookAssignment.student_id == User.id)
        .outerjoin(
            TestSubmission,
            and_(
                TestSubmission.test_id == test_id,
                TestSubmission.student_id == BookAssignment.student_id,
            )
        )
        .where(BookAssignment.book_id == test.book_id)
    )

    # Search by student name or login_id
    if search:
        from sqlalchemy import or_
        query = query.where(
            or_(
                User.name.ilike(f"%{search}%"),
                User.login_id.ilike(f"%{search}%")
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort by student name
    query = query.order_by(User.name.asc())

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).all()

    # Convert results to TestSubmission objects for API compatibility
    submissions = []
    for assignment, user, submission in results:
        if submission:
            submissions.append(submission)
        else:
            # Create a virtual TestSubmission object for students without submission row
            virtual_submission = TestSubmission(
                id=uuid.uuid4(),
                test_id=test_id,
                student_id=user.id,
                submitted_at=None,
                created_at=datetime.now(timezone.utc),
            )
            # Add user info for API response
            virtual_submission._student_name = user.name
            virtual_submission._student_login_id = user.login_id
            submissions.append(virtual_submission)

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return submissions, total, page, page_size, total_pages


async def toggle_submission(
    db: AsyncSession,
    test_id: uuid.UUID,
    student_id: uuid.UUID,
    submission_link: str | None = None,
) -> TestSubmission:
    """Toggle submission status for a student.

    If submitted_at is None, set to now (and save link). If set, clear both.
    """
    result = await db.execute(
        select(TestSubmission).where(
            and_(
                TestSubmission.test_id == test_id,
                TestSubmission.student_id == student_id,
            )
        )
    )
    submission = result.scalar_one_or_none()

    if not submission:
        submission = TestSubmission(
            test_id=test_id,
            student_id=student_id,
            submitted_at=datetime.now(timezone.utc),
            submission_link=submission_link,
        )
        db.add(submission)
    else:
        if submission.submitted_at is None:
            submission.submitted_at = datetime.now(timezone.utc)
            submission.submission_link = submission_link
        else:
            submission.submitted_at = None
            submission.submission_link = None

    await db.commit()
    await db.refresh(submission)
    return submission


async def get_my_submission(
    db: AsyncSession,
    test_id: uuid.UUID,
    student_id: uuid.UUID,
) -> TestSubmission | None:
    """Get a student's submission status for a test."""
    result = await db.execute(
        select(TestSubmission).where(
            and_(
                TestSubmission.test_id == test_id,
                TestSubmission.student_id == student_id,
            )
        )
    )
    return result.scalar_one_or_none()
