import math
import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.question import Question
from app.models.quiz_attempt import QuizAttempt
from app.models.quiz_progress import QuizProgress
from app.models.quiz_set import QuizSet
from app.models.quiz_set_assignment import QuizSetAssignment


# ---------------------------------------------------------------------------
# Tutor: Question CRUD
# ---------------------------------------------------------------------------


async def create_question(
    db: AsyncSession,
    book_id: uuid.UUID | None = None,
    quiz_set_id: uuid.UUID | None = None,
    question_text: str = "",
    question_image_url: str | None = None,
    option_a: str = "",
    option_a_image_url: str | None = None,
    option_b: str = "",
    option_b_image_url: str | None = None,
    option_c: str = "",
    option_c_image_url: str | None = None,
    option_d: str = "",
    option_d_image_url: str | None = None,
    correct_option: str = "",
    explanation: str | None = None,
    time_limit_seconds: int = 60,
) -> Question:
    # Validate exactly one source
    if (book_id and quiz_set_id) or (not book_id and not quiz_set_id):
        raise ValueError("Question must belong to exactly one source: book or quiz_set")

    if book_id:
        book = await db.execute(select(Book).where(Book.id == book_id))
        if book.scalar_one_or_none() is None:
            raise ValueError("Book not found")

    if quiz_set_id:
        qs = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
        if qs.scalar_one_or_none() is None:
            raise ValueError("Quiz set not found")

    question = Question(
        book_id=book_id,
        quiz_set_id=quiz_set_id,
        question_text=question_text,
        question_image_url=question_image_url,
        option_a=option_a,
        option_a_image_url=option_a_image_url,
        option_b=option_b,
        option_b_image_url=option_b_image_url,
        option_c=option_c,
        option_c_image_url=option_c_image_url,
        option_d=option_d,
        option_d_image_url=option_d_image_url,
        correct_option=correct_option,
        explanation=explanation,
        time_limit_seconds=time_limit_seconds,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


async def bulk_create_questions(
    db: AsyncSession,
    book_id: uuid.UUID | None = None,
    quiz_set_id: uuid.UUID | None = None,
    questions_data: list[dict] | None = None,
) -> list[Question]:
    if questions_data is None:
        questions_data = []

    # Validate exactly one source
    if (book_id and quiz_set_id) or (not book_id and not quiz_set_id):
        raise ValueError("Questions must belong to exactly one source: book or quiz_set")

    if book_id:
        book = await db.execute(select(Book).where(Book.id == book_id))
        if book.scalar_one_or_none() is None:
            raise ValueError("Book not found")

    if quiz_set_id:
        qs = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
        if qs.scalar_one_or_none() is None:
            raise ValueError("Quiz set not found")

    created = []
    for data in questions_data:
        q = Question(book_id=book_id, quiz_set_id=quiz_set_id, **data)
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
    question_image_url: str | None = None,
    option_a: str | None = None,
    option_a_image_url: str | None = None,
    option_b: str | None = None,
    option_b_image_url: str | None = None,
    option_c: str | None = None,
    option_c_image_url: str | None = None,
    option_d: str | None = None,
    option_d_image_url: str | None = None,
    correct_option: str | None = None,
    explanation: str | None = None,
    time_limit_seconds: int | None = None,
) -> Question:
    if question_text is not None:
        question.question_text = question_text
    if question_image_url is not None:
        question.question_image_url = question_image_url
    if option_a is not None:
        question.option_a = option_a
    if option_a_image_url is not None:
        question.option_a_image_url = option_a_image_url
    if option_b is not None:
        question.option_b = option_b
    if option_b_image_url is not None:
        question.option_b_image_url = option_b_image_url
    if option_c is not None:
        question.option_c = option_c
    if option_c_image_url is not None:
        question.option_c_image_url = option_c_image_url
    if option_d is not None:
        question.option_d = option_d
    if option_d_image_url is not None:
        question.option_d_image_url = option_d_image_url
    if correct_option is not None:
        question.correct_option = correct_option
    if explanation is not None:
        question.explanation = explanation
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
    book_id: uuid.UUID | None = None,
    quiz_set_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "created_at",
    sort_order: str = "asc",
) -> tuple[list[Question], int, int, int, int]:
    # Build query based on source
    if book_id:
        query = select(Question).where(Question.book_id == book_id)
    elif quiz_set_id:
        query = select(Question).where(Question.quiz_set_id == quiz_set_id)
    else:
        raise ValueError("Either book_id or quiz_set_id must be provided")

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

    allowed_sort = {"created_at", "question_text"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
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
    book_id: uuid.UUID | None = None,
    quiz_set_id: uuid.UUID | None = None,
    question_ids: list[uuid.UUID] | None = None,
) -> None:
    if question_ids is None:
        question_ids = []

    for idx, qid in enumerate(question_ids):
        if book_id:
            result = await db.execute(
                select(Question).where(
                    and_(Question.id == qid, Question.book_id == book_id)
                )
            )
        elif quiz_set_id:
            result = await db.execute(
                select(Question).where(
                    and_(Question.id == qid, Question.quiz_set_id == quiz_set_id)
                )
            )
        else:
            raise ValueError("Either book_id or quiz_set_id must be provided")

        question = result.scalar_one_or_none()
        if question is None:
            raise ValueError(f"Question {qid} not found in this source")
        pass  # reorder is a no-op now that sort_order is removed
    await db.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _validate_assignment(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> None:
    """Validate student has access to this quiz."""
    if quiz_source == "book":
        result = await db.execute(
            select(BookAssignment).where(
                and_(
                    BookAssignment.book_id == quiz_id,
                    BookAssignment.student_id == student_id,
                )
            )
        )
        if result.scalar_one_or_none() is None:
            raise ValueError("Book is not assigned to this student")
    elif quiz_source == "quiz_set":
        result = await db.execute(
            select(QuizSetAssignment).where(
                and_(
                    QuizSetAssignment.quiz_set_id == quiz_id,
                    QuizSetAssignment.student_id == student_id,
                )
            )
        )
        if result.scalar_one_or_none() is None:
            raise ValueError("Quiz set is not assigned to this student")
    else:
        raise ValueError("Invalid quiz_source")


async def _get_progress(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> QuizProgress | None:
    result = await db.execute(
        select(QuizProgress).where(
            and_(
                QuizProgress.student_id == student_id,
                QuizProgress.quiz_source == quiz_source,
                QuizProgress.quiz_id == quiz_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def _get_questions(
    db: AsyncSession,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> list[Question]:
    """Get all questions for a quiz, ordered by created_at."""
    if quiz_source == "book":
        result = await db.execute(
            select(Question)
            .where(Question.book_id == quiz_id)
            .order_by(Question.created_at.asc())
        )
    elif quiz_source == "quiz_set":
        result = await db.execute(
            select(Question)
            .where(Question.quiz_set_id == quiz_id)
            .order_by(Question.created_at.asc())
        )
    else:
        raise ValueError("Invalid quiz_source")

    return list(result.scalars().all())


async def _get_total_quiz_time(
    db: AsyncSession,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> int:
    """Total quiz time = sum of all question time_limit_seconds."""
    if quiz_source == "book":
        result = await db.execute(
            select(func.coalesce(func.sum(Question.time_limit_seconds), 0))
            .where(Question.book_id == quiz_id)
        )
    elif quiz_source == "quiz_set":
        result = await db.execute(
            select(func.coalesce(func.sum(Question.time_limit_seconds), 0))
            .where(Question.quiz_set_id == quiz_id)
        )
    else:
        raise ValueError("Invalid quiz_source")

    return result.scalar() or 0


# ---------------------------------------------------------------------------
# Student: Quiz Flow (Unified)
# ---------------------------------------------------------------------------


async def _get_attempts_map(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> dict[uuid.UUID, QuizAttempt]:
    """Return latest attempt per question."""
    result = await db.execute(
        select(QuizAttempt).where(
            and_(
                QuizAttempt.student_id == student_id,
                QuizAttempt.quiz_source == quiz_source,
                QuizAttempt.quiz_id == quiz_id,
            )
        )
    )
    attempts = list(result.scalars().all())
    by_question: dict[uuid.UUID, QuizAttempt] = {}
    for a in attempts:
        by_question[a.question_id] = a
    return by_question


async def get_quiz_session(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> dict:
    """Get quiz state: questions, progress, existing answers."""
    await _validate_assignment(db, student_id, quiz_source, quiz_id)

    # Load all questions
    questions = await _get_questions(db, quiz_source, quiz_id)
    total_time = await _get_total_quiz_time(db, quiz_source, quiz_id)

    progress = await _get_progress(db, student_id, quiz_source, quiz_id)

    # Load existing answers
    answers: dict = {}
    skipped: dict = {}
    if progress and progress.started_at:
        attempts_map = await _get_attempts_map(db, student_id, quiz_source, quiz_id)
        for qid, attempt in attempts_map.items():
            if attempt.is_skipped:
                skipped[str(qid)] = True
            elif attempt.selected_option is not None:
                answers[str(qid)] = attempt.selected_option

    return {
        "questions": questions,
        "total_questions": len(questions),
        "total_time_seconds": total_time,
        "progress": progress,
        "answers": answers,
        "skipped": skipped,
    }


async def start_quiz(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> QuizProgress:
    """Start a new quiz attempt."""
    await _validate_assignment(db, student_id, quiz_source, quiz_id)

    progress = await _get_progress(db, student_id, quiz_source, quiz_id)

    if progress and progress.is_completed:
        raise ValueError("Quiz already completed. Cannot re-attempt.")

    if progress and progress.started_at:
        # Already started, return existing (resume)
        return progress

    # Get total time and questions count
    total_time = await _get_total_quiz_time(db, quiz_source, quiz_id)
    questions = await _get_questions(db, quiz_source, quiz_id)
    total_questions = len(questions)

    if progress is None:
        progress = QuizProgress(
            student_id=student_id,
            quiz_source=quiz_source,
            quiz_id=quiz_id,
            book_id=quiz_id if quiz_source == "book" else None,
            is_started=True,
            started_at=datetime.now(timezone.utc),
            total_time_seconds=total_time,
            total_questions=total_questions,
        )
        db.add(progress)
    else:
        progress.is_started = True
        progress.started_at = datetime.now(timezone.utc)
        progress.total_time_seconds = total_time
        progress.total_questions = total_questions

    await db.commit()
    await db.refresh(progress)
    return progress


async def submit_answer(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
    question_id: uuid.UUID,
    selected_option: str | None = None,
    is_skipped: bool = False,
    time_taken_seconds: int | None = None,
) -> dict:
    """Submit or update an answer. Handles both regular answers and skips."""
    # Validate that we're not both answering and skipping
    if is_skipped and selected_option:
        raise ValueError("Cannot both skip and provide an answer")

    await _validate_assignment(db, student_id, quiz_source, quiz_id)

    progress = await _get_progress(db, student_id, quiz_source, quiz_id)
    if progress is None or progress.started_at is None:
        raise ValueError("Quiz not started yet")
    if progress.is_completed:
        raise ValueError("Quiz already completed")

    # Check time expired
    elapsed = (datetime.now(timezone.utc) - progress.started_at).total_seconds()
    if elapsed > progress.total_time_seconds:
        await _finalize_quiz(db, progress)
        raise ValueError("Quiz time expired")

    # Verify question belongs to quiz
    question = await get_question(db, question_id)
    if question is None:
        raise ValueError("Question not found")

    if quiz_source == "book" and question.book_id != quiz_id:
        raise ValueError("Question does not belong to this book")
    elif quiz_source == "quiz_set" and question.quiz_set_id != quiz_id:
        raise ValueError("Question does not belong to this quiz set")

    # Determine correctness
    is_correct = False
    if not is_skipped and selected_option:
        is_correct = selected_option.upper() == question.correct_option

    # Check for existing attempt (upsert)
    existing_result = await db.execute(
        select(QuizAttempt).where(
            and_(
                QuizAttempt.student_id == student_id,
                QuizAttempt.quiz_source == quiz_source,
                QuizAttempt.quiz_id == quiz_id,
                QuizAttempt.question_id == question_id,
            )
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Update existing attempt
        was_correct = existing.is_correct
        was_skipped = existing.is_skipped

        existing.selected_option = selected_option.upper() if selected_option else None
        existing.is_correct = is_correct
        existing.is_skipped = is_skipped
        existing.time_taken_seconds = time_taken_seconds

        # Adjust progress counts
        if was_correct and not is_correct:
            progress.correct_count -= 1
        elif not was_correct and is_correct:
            progress.correct_count += 1

        if was_skipped and not is_skipped:
            progress.skipped_count -= 1
        elif not was_skipped and is_skipped:
            progress.skipped_count += 1
    else:
        # New attempt
        attempt = QuizAttempt(
            student_id=student_id,
            quiz_source=quiz_source,
            quiz_id=quiz_id,
            book_id=quiz_id if quiz_source == "book" else None,
            question_id=question_id,
            selected_option=selected_option.upper() if selected_option else None,
            is_correct=is_correct,
            is_skipped=is_skipped,
            time_taken_seconds=time_taken_seconds,
            level_at_attempt=1,
        )
        db.add(attempt)

        progress.total_attempted += 1
        if is_correct:
            progress.correct_count += 1
        if is_skipped:
            progress.skipped_count += 1

    await db.commit()
    await db.refresh(progress)

    return {
        "is_correct": is_correct,
        "is_skipped": is_skipped,
        "correct_option": question.correct_option,
        "explanation": question.explanation,
        "progress": progress,
    }


async def complete_quiz(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> QuizProgress:
    """Manually complete/auto-complete a quiz (exit or timeout)."""
    await _validate_assignment(db, student_id, quiz_source, quiz_id)

    progress = await _get_progress(db, student_id, quiz_source, quiz_id)
    if progress is None or progress.started_at is None:
        raise ValueError("Quiz not started yet")
    if progress.is_completed:
        return progress  # Already done

    await _finalize_quiz(db, progress)
    return progress


async def _finalize_quiz(db: AsyncSession, progress: QuizProgress) -> None:
    """Mark quiz as completed and calculate score."""
    # Recount correct from actual attempts
    correct_result = await db.execute(
        select(func.count()).where(
            and_(
                QuizAttempt.student_id == progress.student_id,
                QuizAttempt.quiz_source == progress.quiz_source,
                QuizAttempt.quiz_id == progress.quiz_id,
                QuizAttempt.is_correct == True,  # noqa: E712
            )
        )
    )
    correct_count = correct_result.scalar() or 0

    skipped_result = await db.execute(
        select(func.count()).where(
            and_(
                QuizAttempt.student_id == progress.student_id,
                QuizAttempt.quiz_source == progress.quiz_source,
                QuizAttempt.quiz_id == progress.quiz_id,
                QuizAttempt.is_skipped == True,  # noqa: E712
            )
        )
    )
    skipped_count = skipped_result.scalar() or 0

    answered_result = await db.execute(
        select(func.count()).where(
            and_(
                QuizAttempt.student_id == progress.student_id,
                QuizAttempt.quiz_source == progress.quiz_source,
                QuizAttempt.quiz_id == progress.quiz_id,
            )
        )
    )
    total_attempted = answered_result.scalar() or 0

    progress.correct_count = correct_count
    progress.skipped_count = skipped_count
    progress.total_attempted = total_attempted
    progress.is_completed = True
    progress.completed_at = datetime.now(timezone.utc)

    total_q = progress.total_questions or 1
    progress.score_percentage = round((correct_count / total_q) * 100, 1)

    await db.commit()
    await db.refresh(progress)


async def get_quiz_progress(
    db: AsyncSession,
    student_id: uuid.UUID,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> QuizProgress | None:
    return await _get_progress(db, student_id, quiz_source, quiz_id)


async def get_question_count(
    db: AsyncSession,
    quiz_source: str,
    quiz_id: uuid.UUID,
) -> int:
    if quiz_source == "book":
        result = await db.execute(
            select(func.count()).where(Question.book_id == quiz_id)
        )
    elif quiz_source == "quiz_set":
        result = await db.execute(
            select(func.count()).where(Question.quiz_set_id == quiz_id)
        )
    else:
        raise ValueError("Invalid quiz_source")

    return result.scalar() or 0
