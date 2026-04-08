import uuid
from datetime import datetime, timezone

from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_set import TestSet, TestSetFile, TestSetAssignment, TestSetSubmission
from app.models.user import User


async def create_test_set(
    db: AsyncSession,
    tutor_id: uuid.UUID,
    name: str,
    description: str | None = None,
    thumbnail_url: str | None = None,
    files: list[dict] | None = None,
) -> TestSet:
    test_set = TestSet(
        tutor_id=tutor_id,
        name=name,
        description=description,
        thumbnail_url=thumbnail_url,
    )
    db.add(test_set)
    await db.flush()

    if files:
        for f in files:
            file_obj = TestSetFile(
                test_set_id=test_set.id,
                file_name=f["file_name"],
                drive_link=f["drive_link"],
                instructions=f.get("instructions"),
            )
            db.add(file_obj)

    await db.commit()

    # Re-fetch with selectin-loaded files (refresh expires relationships)
    result = await db.execute(select(TestSet).where(TestSet.id == test_set.id))
    return result.scalar_one()


async def get_test_set(db: AsyncSession, test_set_id: uuid.UUID) -> TestSet | None:
    result = await db.execute(select(TestSet).where(TestSet.id == test_set_id))
    return result.scalar_one_or_none()


async def update_test_set(
    db: AsyncSession,
    test_set: TestSet,
    name: str | None = None,
    description: str | None = None,
    thumbnail_url: str | None = None,
) -> TestSet:
    if name is not None:
        test_set.name = name
    if description is not None:
        test_set.description = description
    if thumbnail_url is not None:
        test_set.thumbnail_url = thumbnail_url
    await db.commit()
    await db.refresh(test_set)
    return test_set


async def delete_test_set(db: AsyncSession, test_set: TestSet) -> None:
    await db.delete(test_set)
    await db.commit()


async def add_file(
    db: AsyncSession,
    test_set_id: uuid.UUID,
    file_name: str,
    drive_link: str,
    instructions: str | None = None,
) -> TestSetFile:
    file_obj = TestSetFile(
        test_set_id=test_set_id,
        file_name=file_name,
        drive_link=drive_link,
        instructions=instructions,
    )
    db.add(file_obj)
    await db.commit()
    await db.refresh(file_obj)
    return file_obj


async def get_file(db: AsyncSession, file_id: uuid.UUID) -> TestSetFile | None:
    result = await db.execute(select(TestSetFile).where(TestSetFile.id == file_id))
    return result.scalar_one_or_none()


async def update_file(
    db: AsyncSession,
    file_obj: TestSetFile,
    file_name: str | None = None,
    drive_link: str | None = None,
    instructions: str | None = None,
) -> TestSetFile:
    if file_name is not None:
        file_obj.file_name = file_name
    if drive_link is not None:
        file_obj.drive_link = drive_link
    if instructions is not None:
        file_obj.instructions = instructions
    await db.commit()
    await db.refresh(file_obj)
    return file_obj


async def delete_file(db: AsyncSession, file_obj: TestSetFile) -> None:
    await db.delete(file_obj)
    await db.commit()


async def list_submissions(
    db: AsyncSession,
    test_set_id: uuid.UUID,
    page: int,
    page_size: int,
    search: str = "",
) -> tuple[list, int, int, int, int]:
    """List all assigned students with their submission state."""
    query = (
        select(TestSetAssignment, User, TestSetSubmission)
        .join(User, TestSetAssignment.student_id == User.id)
        .outerjoin(
            TestSetSubmission,
            and_(
                TestSetSubmission.test_set_id == test_set_id,
                TestSetSubmission.student_id == TestSetAssignment.student_id,
            )
        )
        .where(TestSetAssignment.test_set_id == test_set_id)
    )

    if search:
        query = query.where(
            or_(
                User.name.ilike(f"%{search}%"),
                User.login_id.ilike(f"%{search}%")
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(User.name.asc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).all()

    submissions = []
    for assignment, user, submission in results:
        if submission:
            submission._student_name = user.name
            submission._student_login_id = user.login_id
            submissions.append(submission)
        else:
            virtual = TestSetSubmission(
                id=uuid.uuid4(),
                test_set_id=test_set_id,
                student_id=user.id,
                submitted_at=None,
                created_at=datetime.now(timezone.utc),
            )
            virtual._student_name = user.name
            virtual._student_login_id = user.login_id
            submissions.append(virtual)

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return submissions, total, page, page_size, total_pages


async def toggle_submission(
    db: AsyncSession,
    test_set_id: uuid.UUID,
    student_id: uuid.UUID,
    submission_link: str | None = None,
) -> TestSetSubmission:
    result = await db.execute(
        select(TestSetSubmission).where(
            and_(
                TestSetSubmission.test_set_id == test_set_id,
                TestSetSubmission.student_id == student_id,
            )
        )
    )
    submission = result.scalar_one_or_none()

    if not submission:
        submission = TestSetSubmission(
            test_set_id=test_set_id,
            student_id=student_id,
            submitted_at=datetime.now(timezone.utc),
            submission_link=submission_link,
        )
        db.add(submission)
    else:
        if submission.submitted_at is None:
            submission.submitted_at = datetime.now(timezone.utc)
        else:
            submission.submitted_at = None
        if submission_link is not None:
            submission.submission_link = submission_link

    await db.commit()
    await db.refresh(submission)
    return submission


async def get_my_submission(
    db: AsyncSession,
    test_set_id: uuid.UUID,
    student_id: uuid.UUID,
) -> TestSetSubmission | None:
    result = await db.execute(
        select(TestSetSubmission).where(
            and_(
                TestSetSubmission.test_set_id == test_set_id,
                TestSetSubmission.student_id == student_id,
            )
        )
    )
    return result.scalar_one_or_none()
