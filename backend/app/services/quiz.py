import math
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.question import Question
from app.models.quiz_attempt import QuizAttempt
from app.models.quiz_progress import QuizProgress


# ---------------------------------------------------------------------------
# Tutor: Question CRUD
# ---------------------------------------------------------------------------


async def create_question(
    db: AsyncSession,
    book_id: uuid.UUID,
    question_text: str,
    option_a: str,
    option_b: str,
    option_c: str,
    option_d: str,
    correct_option: str,
    explanation: str | None = None,
    sort_order: int = 0,
    time_limit_seconds: int = 60,
) -> Question:
    book = await db.execute(select(Book).where(Book.id == book_id))
    if book.scalar_one_or_none() is None:
        raise ValueError("Book not found")

    question = Question(
        book_id=book_id,
        question_text=question_text,
        option_a=option_a,
        option_b=option_b,
        option_c=option_c,
        option_d=option_d,
        correct_option=correct_option,
        explanation=explanation,
        sort_order=sort_order,
        time_limit_seconds=time_limit_seconds,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


async def bulk_create_questions(
    db: AsyncSession,
    book_id: uuid.UUID,
    questions_data: list[dict],
) -> list[Question]:
    book = await db.execute(select(Book).where(Book.id == book_id))
    if book.scalar_one_or_none() is None:
        raise ValueError("Book not found")

    created = []
    for data in questions_data:
        q = Question(book_id=book_id, **data)
        db.add(q)
        created.append(q)

    await db.commit()
    for q in created:
        await db.refresh(q)
    return created


async def get_question(db: AsyncSession, question_id: uuid.UUID) -> Question | None:
    result = await db.execute(select(Question).where(Question.id == question_id))
    return result.scalar_one_or_none()


async def update_question(
    db: AsyncSession,
    question: Question,
    question_text: str | None = None,
    option_a: str | None = None,
    option_b: str | None = None,
    option_c: str | None = None,
    option_d: str | None = None,
    correct_option: str | None = None,
    explanation: str | None = None,
    sort_order: int | None = None,
    time_limit_seconds: int | None = None,
) -> Question:
    if question_text is not None:
        question.question_text = question_text
    if option_a is not None:
        question.option_a = option_a
    if option_b is not None:
        question.option_b = option_b
    if option_c is not None:
        question.option_c = option_c
    if option_d is not None:
        question.option_d = option_d
    if correct_option is not None:
        question.correct_option = correct_option
    if explanation is not None:
        question.explanation = explanation
    if sort_order is not None:
        question.sort_order = sort_order
    if time_limit_seconds is not None:
        question.time_limit_seconds = time_limit_seconds

    await db.commit()
    await db.refresh(question)
    return question


async def delete_question(db: AsyncSession, question: Question) -> None:
    await db.delete(question)
    await db.commit()


async def list_questions(
    db: AsyncSession,
    book_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "sort_order",
    sort_order: str = "asc",
) -> tuple[list[Question], int, int, int, int]:
    query = select(Question).where(Question.book_id == book_id)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Question.question_text.ilike(search_term),
                Question.option_a.ilike(search_term),
                Question.option_b.ilike(search_term),
                Question.option_c.ilike(search_term),
                Question.option_d.ilike(search_term),
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    allowed_sort = {"sort_order", "created_at", "question_text"}
    if sort_by not in allowed_sort:
        sort_by = "sort_order"
    sort_col = getattr(Question, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    questions = list(result.scalars().all())

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0
    return questions, total, page, page_size, total_pages


async def reorder_questions(
    db: AsyncSession,
    book_id: uuid.UUID,
    question_ids: list[uuid.UUID],
) -> None:
    for idx, qid in enumerate(question_ids):
        result = await db.execute(
            select(Question).where(Question.id == qid, Question.book_id == book_id)
        )
        question = result.scalar_one_or_none()
        if question is None:
            raise ValueError(f"Question {qid} not found in this book")
        question.sort_order = idx
    await db.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _validate_assignment(
    db: AsyncSession, student_id: uuid.UUID, book_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(BookAssignment).where(
            BookAssignment.book_id == book_id,
            BookAssignment.student_id == student_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("Book is not assigned to this student")


async def _get_progress(
    db: AsyncSession, student_id: uuid.UUID, book_id: uuid.UUID
) -> QuizProgress | None:
    result = await db.execute(
        select(QuizProgress).where(
            QuizProgress.student_id == student_id,
            QuizProgress.book_id == book_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_total_quiz_time(db: AsyncSession, book_id: uuid.UUID) -> int:
    """Total quiz time = sum of all question time_limit_seconds."""
    result = await db.execute(
        select(func.coalesce(func.sum(Question.time_limit_seconds), 0))
        .where(Question.book_id == book_id)
    )
    return result.scalar() or 0


# ---------------------------------------------------------------------------
# Student: Quiz Flow
# ---------------------------------------------------------------------------


async def _get_attempts_map(
    db: AsyncSession, student_id: uuid.UUID, book_id: uuid.UUID
) -> dict[uuid.UUID, QuizAttempt]:
    """Return latest attempt per question as {question_id: QuizAttempt}."""
    result = await db.execute(
        select(QuizAttempt)
        .where(
            QuizAttempt.student_id == student_id,
            QuizAttempt.book_id == book_id,
        )
    )
    attempts = list(result.scalars().all())
    # Keep latest attempt per question (in case of re-answers, though we upsert)
    by_question: dict[uuid.UUID, QuizAttempt] = {}
    for a in attempts:
        by_question[a.question_id] = a
    return by_question


async def get_quiz_session(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
) -> dict:
    """Get quiz state: questions, progress, existing answers."""
    await _validate_assignment(db, student_id, book_id)

    # Load all questions ordered by sort_order
    result = await db.execute(
        select(Question)
        .where(Question.book_id == book_id)
        .order_by(Question.sort_order.asc())
    )
    questions = list(result.scalars().all())
    total_time = await _get_total_quiz_time(db, book_id)

    progress = await _get_progress(db, student_id, book_id)

    # Load existing answers (for resume / review)
    answers: dict = {}
    if progress and progress.started_at:
        attempts_map = await _get_attempts_map(db, student_id, book_id)
        for qid, attempt in attempts_map.items():
            if attempt.selected_option is not None:
                answers[str(qid)] = attempt.selected_option

    return {
        "questions": questions,
        "total_questions": len(questions),
        "total_time_seconds": total_time,
        "progress": progress,
        "answers": answers,  # {question_id_str: selected_option}
    }


async def start_quiz(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
) -> QuizProgress:
    """Start a new quiz attempt. Fails if already completed."""
    await _validate_assignment(db, student_id, book_id)

    progress = await _get_progress(db, student_id, book_id)

    if progress and progress.is_completed:
        raise ValueError("Quiz already completed. Cannot re-attempt.")

    if progress and progress.started_at:
        # Already started, return existing (resume)
        return progress

    # Get total time
    total_time = await _get_total_quiz_time(db, book_id)

    if progress is None:
        progress = QuizProgress(
            student_id=student_id,
            book_id=book_id,
            started_at=datetime.now(timezone.utc),
            total_time_seconds=total_time,
        )
        db.add(progress)
    else:
        progress.started_at = datetime.now(timezone.utc)
        progress.total_time_seconds = total_time

    await db.commit()
    await db.refresh(progress)
    return progress


async def submit_answer(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
    question_id: uuid.UUID,
    selected_option: str,
    time_taken_seconds: int | None = None,
) -> dict:
    """Submit or update an answer. Allows changing answers freely during quiz."""
    await _validate_assignment(db, student_id, book_id)

    progress = await _get_progress(db, student_id, book_id)
    if progress is None or progress.started_at is None:
        raise ValueError("Quiz not started yet")
    if progress.is_completed:
        raise ValueError("Quiz already completed")

    # Check time expired
    elapsed = (datetime.now(timezone.utc) - progress.started_at).total_seconds()
    if elapsed > progress.total_time_seconds:
        await _finalize_quiz(db, progress)
        raise ValueError("Quiz time expired")

    # Verify question belongs to book
    result = await db.execute(
        select(Question).where(
            Question.id == question_id,
            Question.book_id == book_id,
        )
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise ValueError("Question not found in this book")

    is_correct = selected_option.upper() == question.correct_option

    # Check for existing attempt (upsert)
    existing_result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.student_id == student_id,
            QuizAttempt.book_id == book_id,
            QuizAttempt.question_id == question_id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Update existing attempt — adjust correct_count
        was_correct = existing.is_correct
        existing.selected_option = selected_option.upper()
        existing.is_correct = is_correct
        existing.time_taken_seconds = time_taken_seconds

        # Adjust progress.correct_count based on change
        if was_correct and not is_correct:
            progress.correct_count -= 1
        elif not was_correct and is_correct:
            progress.correct_count += 1
    else:
        # New attempt
        attempt = QuizAttempt(
            student_id=student_id,
            book_id=book_id,
            question_id=question_id,
            selected_option=selected_option.upper(),
            is_correct=is_correct,
            time_taken_seconds=time_taken_seconds,
            level_at_attempt=1,
        )
        db.add(attempt)

        progress.total_attempted += 1
        if is_correct:
            progress.correct_count += 1

    await db.commit()
    await db.refresh(progress)

    return {
        "is_correct": is_correct,
        "correct_option": question.correct_option,
        "explanation": question.explanation,
        "progress": progress,
    }


async def complete_quiz(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
) -> QuizProgress:
    """Manually complete/auto-complete a quiz (exit or timeout)."""
    await _validate_assignment(db, student_id, book_id)

    progress = await _get_progress(db, student_id, book_id)
    if progress is None or progress.started_at is None:
        raise ValueError("Quiz not started yet")
    if progress.is_completed:
        return progress  # Already done

    await _finalize_quiz(db, progress)
    return progress


async def _finalize_quiz(db: AsyncSession, progress: QuizProgress) -> None:
    """Mark quiz as completed and calculate score from actual attempts."""
    total_q = await db.execute(
        select(func.count()).where(Question.book_id == progress.book_id)
    )
    total_questions = total_q.scalar() or 1

    # Recount correct from actual attempts for accuracy
    correct_result = await db.execute(
        select(func.count()).where(
            QuizAttempt.student_id == progress.student_id,
            QuizAttempt.book_id == progress.book_id,
            QuizAttempt.is_correct == True,  # noqa: E712
        )
    )
    correct_count = correct_result.scalar() or 0
    progress.correct_count = correct_count

    answered_result = await db.execute(
        select(func.count()).where(
            QuizAttempt.student_id == progress.student_id,
            QuizAttempt.book_id == progress.book_id,
        )
    )
    progress.total_attempted = answered_result.scalar() or 0

    progress.is_completed = True
    progress.completed_at = datetime.now(timezone.utc)
    progress.score_percentage = round(
        (correct_count / total_questions) * 100, 1
    )

    await db.commit()
    await db.refresh(progress)


async def get_quiz_progress(
    db: AsyncSession,
    student_id: uuid.UUID,
    book_id: uuid.UUID,
) -> QuizProgress | None:
    return await _get_progress(db, student_id, book_id)


async def get_question_count(db: AsyncSession, book_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).where(Question.book_id == book_id)
    )
    return result.scalar() or 0
