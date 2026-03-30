import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_student, require_tutor
from app.schemas.pagination import PaginatedResponse
from app.schemas.quiz import (
    QuestionBulkCreate,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
    QuizProgressOut,
    QuizSessionOut,
    QuizSubmitRequest,
    QuizSubmitResponse,
    ReorderRequest,
    ReviewQuestionOut,
    StudentQuestionOut,
)
from app.services.quiz import (
    bulk_create_questions,
    complete_quiz,
    create_question,
    delete_question,
    get_question,
    get_quiz_progress,
    get_quiz_session,
    list_questions,
    reorder_questions,
    start_quiz,
    submit_answer,
    update_question,
)

router = APIRouter(tags=["quiz"])


def _question_to_out(q) -> QuestionOut:
    return QuestionOut(
        id=str(q.id),
        book_id=str(q.book_id) if q.book_id else None,
        quiz_set_id=str(q.quiz_set_id) if q.quiz_set_id else None,
        question_text=q.question_text,
        question_image_url=q.question_image_url,
        option_a=q.option_a,
        option_a_image_url=q.option_a_image_url,
        option_b=q.option_b,
        option_b_image_url=q.option_b_image_url,
        option_c=q.option_c,
        option_c_image_url=q.option_c_image_url,
        option_d=q.option_d,
        option_d_image_url=q.option_d_image_url,
        correct_option=q.correct_option,
        explanation=q.explanation,
        time_limit_seconds=q.time_limit_seconds,
        created_at=q.created_at,
    )


def _question_to_student_out(q) -> StudentQuestionOut:
    return StudentQuestionOut(
        id=str(q.id),
        question_text=q.question_text,
        question_image_url=q.question_image_url,
        option_a=q.option_a,
        option_a_image_url=q.option_a_image_url,
        option_b=q.option_b,
        option_b_image_url=q.option_b_image_url,
        option_c=q.option_c,
        option_c_image_url=q.option_c_image_url,
        option_d=q.option_d,
        option_d_image_url=q.option_d_image_url,
        time_limit_seconds=q.time_limit_seconds,
    )


def _progress_to_out(p) -> QuizProgressOut:
    return QuizProgressOut(
        correct_count=p.correct_count,
        skipped_count=p.skipped_count,
        total_attempted=p.total_attempted,
        total_questions=p.total_questions,
        current_question_index=p.current_question_index,
        is_started=p.is_started,
        is_completed=p.is_completed,
        started_at=p.started_at,
        completed_at=p.completed_at,
        score_percentage=p.score_percentage,
        total_time_seconds=p.total_time_seconds,
    )


# ---------------------------------------------------------------------------
# Tutor: Question CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/api/books/{book_id}/questions",
    response_model=PaginatedResponse[QuestionOut],
)
async def list_questions_endpoint(
    book_id: uuid.UUID,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    questions, total, pg, ps, total_pages = await list_questions(
        db, book_id=book_id, page=page, page_size=page_size,
        search=search, sort_by=sort_by, sort_order=sort_order,
    )
    return PaginatedResponse(
        items=[_question_to_out(q) for q in questions],
        total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post(
    "/api/books/{book_id}/questions",
    response_model=QuestionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_question_endpoint(
    book_id: uuid.UUID,
    body: QuestionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    try:
        question = await create_question(
            db, book_id=book_id,
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


@router.post(
    "/api/books/{book_id}/questions/bulk",
    status_code=status.HTTP_201_CREATED,
)
async def bulk_create_questions_endpoint(
    book_id: uuid.UUID,
    body: QuestionBulkCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    try:
        questions = await bulk_create_questions(
            db, book_id=book_id,
            questions_data=[q.model_dump() for q in body.questions],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"detail": f"{len(questions)} questions created", "created": len(questions)}


@router.get("/api/questions/{question_id}", response_model=QuestionOut)
async def get_question_endpoint(
    question_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    question = await get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return _question_to_out(question)


@router.put("/api/questions/{question_id}", response_model=QuestionOut)
async def update_question_endpoint(
    question_id: uuid.UUID,
    body: QuestionUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    question = await get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    try:
        question = await update_question(
            db, question,
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


@router.delete(
    "/api/questions/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_question_endpoint(
    question_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    question = await get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    await delete_question(db, question)


@router.put("/api/books/{book_id}/questions/reorder")
async def reorder_questions_endpoint(
    book_id: uuid.UUID,
    body: ReorderRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    try:
        await reorder_questions(
            db, book_id=book_id,
            question_ids=[uuid.UUID(qid) for qid in body.question_ids],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"detail": "Questions reordered"}


# ---------------------------------------------------------------------------
# Student: Quiz Flow
# ---------------------------------------------------------------------------


@router.get("/api/books/{book_id}/quiz", response_model=QuizSessionOut)
async def get_quiz_session_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    try:
        session = await get_quiz_session(db, student_id=student.id, quiz_source="book", quiz_id=book_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    progress = session["progress"]
    answers = session.get("answers", {})
    skipped = session.get("skipped", {})

    # Build review data only when quiz is completed
    review = None
    if progress and progress.is_completed:
        review = []
        for q in session["questions"]:
            qid = str(q.id)
            student_answer = answers.get(qid)
            review.append(ReviewQuestionOut(
                id=qid,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_option=q.correct_option,
                explanation=q.explanation,
                selected_option=student_answer,
                is_correct=student_answer == q.correct_option if student_answer else False,
            ))

    return QuizSessionOut(
        questions=[_question_to_student_out(q) for q in session["questions"]],
        total_questions=session["total_questions"],
        total_time_seconds=session["total_time_seconds"],
        progress=_progress_to_out(progress) if progress else None,
        answers=answers,
        skipped=skipped,
        review=review,
    )


@router.post("/api/books/{book_id}/quiz/start", response_model=QuizProgressOut)
async def start_quiz_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    try:
        progress = await start_quiz(db, student_id=student.id, quiz_source="book", quiz_id=book_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _progress_to_out(progress)


@router.post("/api/books/{book_id}/quiz/submit", response_model=QuizSubmitResponse)
async def submit_answer_endpoint(
    book_id: uuid.UUID,
    body: QuizSubmitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    try:
        result = await submit_answer(
            db, student_id=student.id, quiz_source="book", quiz_id=book_id,
            question_id=uuid.UUID(body.question_id),
            selected_option=body.selected_option,
            is_skipped=body.is_skipped,
            time_taken_seconds=body.time_taken_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return QuizSubmitResponse(
        is_correct=result["is_correct"],
        is_skipped=result["is_skipped"],
        correct_option=result["correct_option"],
        explanation=result["explanation"],
        progress=_progress_to_out(result["progress"]),
    )


@router.post("/api/books/{book_id}/quiz/complete", response_model=QuizProgressOut)
async def complete_quiz_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Auto-complete quiz on exit or timeout."""
    student = require_student(request)
    try:
        progress = await complete_quiz(db, student_id=student.id, quiz_source="book", quiz_id=book_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _progress_to_out(progress)


@router.get("/api/books/{book_id}/quiz/progress", response_model=QuizProgressOut | None)
async def get_quiz_progress_endpoint(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)
    progress = await get_quiz_progress(db, student_id=student.id, quiz_source="book", quiz_id=book_id)
    if progress is None:
        return None
    return _progress_to_out(progress)
