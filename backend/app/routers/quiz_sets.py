import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_student, require_tutor
from app.models.quiz_set import QuizSet
from app.models.quiz_set_assignment import QuizSetAssignment
from app.models.user import User, UserType
from app.schemas.quiz_sets import (
    QuizSetCreate, QuizSetUpdate, QuizSetOut, QuizSetAssignCreate, QuizSetAssignOut,
    AssignedQuizSetOut, QuizSetLeaderboardEntryOut
)
from app.schemas.quiz import (
    QuestionCreate, QuestionBulkCreate, QuestionOut, ReorderRequest, QuizSubmitRequest
)
from app.routers.quiz import _question_to_out
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import create_and_notify
from app.services.quiz import (
    get_quiz_session, start_quiz, submit_answer, complete_quiz, get_quiz_progress,
    list_questions, create_question, bulk_create_questions, reorder_questions,
    get_quiz_set_leaderboard,
)

router = APIRouter(tags=["quiz_sets"])


# ============================================================================
# TUTOR CRUD ENDPOINTS
# ============================================================================

@router.get("/api/quiz-sets", response_model=PaginatedResponse[QuizSetOut])
async def list_quiz_sets(
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    """List quiz sets for tutor."""
    require_tutor(request)

    query = select(QuizSet)

    # Search by name or description
    if search:
        query = query.where(
            or_(
                QuizSet.name.ilike(f"%{search}%"),
                QuizSet.description.ilike(f"%{search}%")
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    allowed_sort = {"created_at", "name"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    sort_column = getattr(QuizSet, sort_by)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).scalars().all()

    # Count questions for each quiz set
    items = []
    for qs in results:
        question_count = len(qs.questions)
        items.append(QuizSetOut(
            id=str(qs.id),
            name=qs.name,
            description=qs.description,
            thumbnail_url=qs.thumbnail_url,
            created_by=str(qs.tutor_id),
            question_count=question_count,
            created_at=qs.created_at,
            updated_at=qs.updated_at,
        ))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/api/quiz-sets", response_model=QuizSetOut, status_code=status.HTTP_201_CREATED)
async def create_quiz_set(
    request: Request,
    body: QuizSetCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new quiz set."""
    tutor = require_tutor(request)

    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    new_quiz_set = QuizSet(
        tutor_id=tutor.id,
        name=body.name.strip(),
        description=body.description,
        thumbnail_url=body.thumbnail_url,
    )
    db.add(new_quiz_set)

    try:
        await db.commit()
        await db.refresh(new_quiz_set)
    except IntegrityError as e:
        await db.rollback()
        import logging
        logging.getLogger(__name__).exception("IntegrityError creating quiz set")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create quiz set: {getattr(e, 'orig', e)}",
        )

    return QuizSetOut(
        id=str(new_quiz_set.id),
        name=new_quiz_set.name,
        description=new_quiz_set.description,
        thumbnail_url=new_quiz_set.thumbnail_url,
        created_by=str(new_quiz_set.tutor_id),
        question_count=0,
        created_at=new_quiz_set.created_at,
        updated_at=new_quiz_set.updated_at,
    )


@router.get("/api/quiz-sets/{quiz_set_id}", response_model=QuizSetOut)
async def get_quiz_set(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get a single quiz set. Tutors can access any; students only if assigned."""
    user = get_current_user(request)

    result = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    quiz_set = result.scalar_one_or_none()

    if not quiz_set:
        raise HTTPException(status_code=404, detail="Quiz set not found")

    if user.user_type != UserType.tutor:
        # Student must have an assignment
        assign_result = await db.execute(
            select(QuizSetAssignment).where(
                and_(
                    QuizSetAssignment.quiz_set_id == quiz_set_id,
                    QuizSetAssignment.student_id == user.id,
                )
            )
        )
        if not assign_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Quiz set not found")

    question_count = len(quiz_set.questions)
    return QuizSetOut(
        id=str(quiz_set.id),
        name=quiz_set.name,
        description=quiz_set.description,
        thumbnail_url=quiz_set.thumbnail_url,
        created_by=str(quiz_set.tutor_id),
        question_count=question_count,
        created_at=quiz_set.created_at,
        updated_at=quiz_set.updated_at,
    )


@router.put("/api/quiz-sets/{quiz_set_id}", response_model=QuizSetOut)
async def update_quiz_set(
    quiz_set_id: uuid.UUID,
    body: QuizSetUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update a quiz set. Owner only."""
    tutor = require_tutor(request)

    result = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    quiz_set = result.scalar_one_or_none()

    if not quiz_set:
        raise HTTPException(status_code=404, detail="Quiz set not found")

    # Owner check
    if str(quiz_set.tutor_id) != str(tutor.id):
        raise HTTPException(status_code=403, detail="You don't have permission to update this quiz set")

    if body.name is not None:
        quiz_set.name = body.name
    if body.description is not None:
        quiz_set.description = body.description
    if body.thumbnail_url is not None:
        quiz_set.thumbnail_url = body.thumbnail_url

    try:
        await db.commit()
        await db.refresh(quiz_set)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update quiz set")

    question_count = len(quiz_set.questions)
    return QuizSetOut(
        id=str(quiz_set.id),
        name=quiz_set.name,
        description=quiz_set.description,
        thumbnail_url=quiz_set.thumbnail_url,
        created_by=str(quiz_set.tutor_id),
        question_count=question_count,
        created_at=quiz_set.created_at,
        updated_at=quiz_set.updated_at,
    )


@router.delete("/api/quiz-sets/{quiz_set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz_set(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete a quiz set. Owner only."""
    tutor = require_tutor(request)

    result = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    quiz_set = result.scalar_one_or_none()

    if not quiz_set:
        raise HTTPException(status_code=404, detail="Quiz set not found")

    # Owner check
    if str(quiz_set.tutor_id) != str(tutor.id):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this quiz set")

    await db.delete(quiz_set)
    await db.commit()


# ============================================================================
# QUESTIONS SUB-RESOURCE
# ============================================================================

@router.get("/api/quiz-sets/{quiz_set_id}/questions", response_model=PaginatedResponse[QuestionOut])
async def list_quiz_set_questions(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("asc"),
):
    """List questions for a quiz set."""
    require_tutor(request)

    questions, total, pg, ps, total_pages = await list_questions(
        db, quiz_set_id=quiz_set_id, page=page, page_size=page_size,
        search=search, sort_by=sort_by, sort_order=sort_order,
    )
    return PaginatedResponse(
        items=[_question_to_out(q) for q in questions],
        total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post("/api/quiz-sets/{quiz_set_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_quiz_set_question(
    quiz_set_id: uuid.UUID,
    body: QuestionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a question for a quiz set."""
    require_tutor(request)

    try:
        question = await create_question(
            db, quiz_set_id=quiz_set_id,
            question_text=body.question_text,
            question_image_url=body.question_image_url,
            option_a=body.option_a, option_a_image_url=body.option_a_image_url,
            option_b=body.option_b, option_b_image_url=body.option_b_image_url,
            option_c=body.option_c, option_c_image_url=body.option_c_image_url,
            option_d=body.option_d, option_d_image_url=body.option_d_image_url,
            correct_option=body.correct_option,
            explanation=body.explanation,
            time_limit_seconds=body.time_limit_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _question_to_out(question)


@router.post("/api/quiz-sets/{quiz_set_id}/questions/bulk", response_model=list[QuestionOut], status_code=status.HTTP_201_CREATED)
async def bulk_create_quiz_set_questions(
    quiz_set_id: uuid.UUID,
    body: QuestionBulkCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Bulk create questions for a quiz set."""
    require_tutor(request)

    try:
        questions = await bulk_create_questions(
            db, quiz_set_id=quiz_set_id,
            questions_data=[q.model_dump() for q in body.questions],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return [_question_to_out(q) for q in questions]


@router.put("/api/quiz-sets/{quiz_set_id}/questions/reorder", response_model=dict)
async def reorder_quiz_set_questions(
    quiz_set_id: uuid.UUID,
    body: ReorderRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Reorder questions for a quiz set."""
    require_tutor(request)

    try:
        await reorder_questions(
            db, quiz_set_id=quiz_set_id,
            question_ids=[uuid.UUID(qid) for qid in body.question_ids],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"status": "ok"}


# ============================================================================
# ASSIGNMENTS SUB-RESOURCE
# ============================================================================

@router.get("/api/quiz-sets/{quiz_set_id}/assignments", response_model=PaginatedResponse[QuizSetAssignOut])
async def list_quiz_set_assignments(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
):
    """List students assigned to a quiz set."""
    require_tutor(request)

    # Verify quiz set exists
    result = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Quiz set not found")

    query = (
        select(QuizSetAssignment, User.name, User.login_id)
        .join(User, QuizSetAssignment.student_id == User.id)
        .where(QuizSetAssignment.quiz_set_id == quiz_set_id)
    )

    # Search by student name or login_id
    if search:
        query = query.where(
            or_(
                User.name.ilike(f"%{search}%"),
                User.login_id.ilike(f"%{search}%")
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await db.execute(query)).all()

    items = [
        QuizSetAssignOut(
            id=str(assign.id),
            quiz_set_id=str(assign.quiz_set_id),
            student_id=str(assign.student_id),
            student_name=name,
            student_login_id=login_id,
            created_at=assign.created_at,
        )
        for assign, name, login_id in results
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/api/quiz-sets/{quiz_set_id}/assignments", response_model=QuizSetAssignOut, status_code=status.HTTP_201_CREATED)
async def assign_student_to_quiz_set(
    quiz_set_id: uuid.UUID,
    body: QuizSetAssignCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Assign a student to a quiz set."""
    tutor = require_tutor(request)

    # Verify quiz set exists
    result = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    quiz_set = result.scalar_one_or_none()
    if not quiz_set:
        raise HTTPException(status_code=404, detail="Quiz set not found")

    try:
        student_id = uuid.UUID(body.student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid student_id")

    # Check if student exists
    result = await db.execute(select(User).where(User.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Create assignment
    assignment = QuizSetAssignment(
        quiz_set_id=quiz_set_id,
        student_id=student_id,
    )
    db.add(assignment)

    try:
        await db.commit()
        await db.refresh(assignment)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Student already assigned to this quiz set")

    await create_and_notify(
        db, recipient_id=student_id, sender_id=tutor.id,
        message=f"{tutor.name} assigned you quiz set: '{quiz_set.name}'",
        notification_type="quiz_set_assigned", reference_id=quiz_set_id,
    )

    return QuizSetAssignOut(
        id=str(assignment.id),
        quiz_set_id=str(assignment.quiz_set_id),
        student_id=str(assignment.student_id),
        student_name=student.name,
        student_login_id=student.login_id,
        created_at=assignment.created_at,
    )


@router.delete("/api/quiz-sets/{quiz_set_id}/assignments/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_student_from_quiz_set(
    quiz_set_id: uuid.UUID,
    student_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Unassign a student from a quiz set."""
    tutor = require_tutor(request)

    result = await db.execute(
        select(QuizSetAssignment).where(
            and_(
                QuizSetAssignment.quiz_set_id == quiz_set_id,
                QuizSetAssignment.student_id == student_id,
            )
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Fetch quiz set name for notification
    qs_result = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    quiz_set = qs_result.scalar_one()

    await db.delete(assignment)
    await db.commit()

    await create_and_notify(
        db, recipient_id=student_id, sender_id=tutor.id,
        message=f"{tutor.name} unassigned you from quiz set: '{quiz_set.name}'",
        notification_type="quiz_set_unassigned", reference_id=quiz_set_id,
    )


# ============================================================================
# STUDENT QUIZ ENDPOINTS
# ============================================================================

@router.get("/api/quiz-sets/{quiz_set_id}/quiz")
async def get_quiz_set_quiz_session(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get quiz session for a student."""
    student = require_student(request)

    try:
        return await get_quiz_session(db, student.id, "quiz_set", quiz_set_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/api/quiz-sets/{quiz_set_id}/quiz/start")
async def start_quiz_set_quiz(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Start or resume a quiz set quiz."""
    student = require_student(request)

    try:
        return await start_quiz(db, student.id, "quiz_set", quiz_set_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/api/quiz-sets/{quiz_set_id}/quiz/submit")
async def submit_quiz_set_answer(
    quiz_set_id: uuid.UUID,
    body: QuizSubmitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Submit or update an answer."""
    student = require_student(request)

    try:
        return await submit_answer(
            db, student.id, "quiz_set", quiz_set_id,
            question_id=uuid.UUID(body.question_id),
            selected_option=body.selected_option,
            is_skipped=body.is_skipped,
            time_taken_seconds=body.time_taken_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/api/quiz-sets/{quiz_set_id}/quiz/complete")
async def complete_quiz_set_quiz(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Complete a quiz set quiz."""
    student = require_student(request)

    try:
        return await complete_quiz(db, student.id, "quiz_set", quiz_set_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/api/quiz-sets/{quiz_set_id}/quiz/progress")
async def get_quiz_set_quiz_progress(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get current progress only."""
    student = require_student(request)

    try:
        return await get_quiz_progress(db, student.id, "quiz_set", quiz_set_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# STUDENT LISTING ENDPOINT
# ============================================================================

@router.get("/api/students/quiz-sets", response_model=list[AssignedQuizSetOut])
async def list_student_quiz_sets(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """List quiz sets assigned to the student."""
    student = require_student(request)

    # Query: QuizSetAssignment -> QuizSet, with optional QuizProgress join
    from app.models.quiz_progress import QuizProgress

    query = (
        select(QuizSet, QuizProgress)
        .join(QuizSetAssignment, QuizSet.id == QuizSetAssignment.quiz_set_id)
        .outerjoin(
            QuizProgress,
            and_(
                QuizProgress.quiz_id == QuizSet.id,
                QuizProgress.quiz_source == "quiz_set",
                QuizProgress.student_id == student.id,
            )
        )
        .where(QuizSetAssignment.student_id == student.id)
        .order_by(QuizSet.created_at.desc())
    )

    results = (await db.execute(query)).all()

    items = []
    for row in results:
        quiz_set = row[0]
        progress = row[1]

        question_count = len(quiz_set.questions)
        progress_dict = None
        if progress:
            progress_dict = {
                "is_started": progress.is_started,
                "is_completed": progress.is_completed,
                "correct_count": progress.correct_count,
                "skipped_count": progress.skipped_count,
                "total_questions": progress.total_questions,
                "score_percentage": progress.score_percentage,
            }

        items.append(AssignedQuizSetOut(
            id=str(quiz_set.id),
            name=quiz_set.name,
            description=quiz_set.description,
            thumbnail_url=quiz_set.thumbnail_url,
            question_count=question_count,
            progress=progress_dict,
        ))

    return items


# ============================================================================
# LEADERBOARD
# ============================================================================

@router.get(
    "/api/quiz-sets/{quiz_set_id}/leaderboard",
    response_model=list[QuizSetLeaderboardEntryOut],
)
async def list_quiz_set_leaderboard(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    qs = (
        await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
    ).scalar_one_or_none()
    if not qs:
        raise HTTPException(status_code=404, detail="Quiz set not found")
    return await get_quiz_set_leaderboard(db, quiz_set_id)


@router.get(
    "/api/students/quiz-sets/{quiz_set_id}/leaderboard",
    response_model=list[QuizSetLeaderboardEntryOut],
)
async def get_student_quiz_set_leaderboard(
    quiz_set_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    assigned = (
        await db.execute(
            select(QuizSetAssignment).where(
                and_(
                    QuizSetAssignment.quiz_set_id == quiz_set_id,
                    QuizSetAssignment.student_id == student.id,
                )
            )
        )
    ).scalar_one_or_none()
    if not assigned:
        raise HTTPException(status_code=403, detail="Not assigned to this quiz set")
    return await get_quiz_set_leaderboard(db, quiz_set_id)
