from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_tutor
from app.models.book_assignment import BookAssignment
from app.models.quiz_progress import QuizProgress
from app.models.user import User, UserType

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)

    # Total students
    total_students = (
        await db.execute(
            select(func.count()).where(User.user_type == UserType.student)
        )
    ).scalar() or 0

    # Average quiz score (completed topic quizzes only)
    avg_score = (
        await db.execute(
            select(func.avg(QuizProgress.score_percentage)).where(
                QuizProgress.is_completed == True,  # noqa: E712
                QuizProgress.quiz_source == "topic",
            )
        )
    ).scalar()
    avg_quiz_score = round(avg_score, 1) if avg_score is not None else 0

    # Assignment completion rate: students who completed any topic quiz / students with assignments
    total_assignments = (
        await db.execute(select(func.count()).select_from(BookAssignment))
    ).scalar() or 0

    students_with_assignments = (
        await db.execute(
            select(func.count(func.distinct(BookAssignment.student_id)))
        )
    ).scalar() or 0

    students_completed_quiz = (
        await db.execute(
            select(func.count(func.distinct(QuizProgress.student_id))).where(
                QuizProgress.is_completed == True,  # noqa: E712
                QuizProgress.quiz_source == "topic",
            )
        )
    ).scalar() or 0

    completion_rate = (
        round(min(100.0, (students_completed_quiz / students_with_assignments) * 100), 1)
        if students_with_assignments > 0
        else 0
    )

    # Top performers: students with average completed quiz score >= 80%
    top_performers_q = (
        select(func.count())
        .select_from(
            select(QuizProgress.student_id)
            .where(
                QuizProgress.is_completed == True,  # noqa: E712
                QuizProgress.quiz_source == "topic",
            )
            .group_by(QuizProgress.student_id)
            .having(func.avg(QuizProgress.score_percentage) >= 80)
            .subquery()
        )
    )
    top_performers = (await db.execute(top_performers_q)).scalar() or 0

    # Quiz completion rate (started vs completed)
    total_started = (
        await db.execute(
            select(func.count()).where(QuizProgress.is_started == True)  # noqa: E712
        )
    ).scalar() or 0

    total_completed = (
        await db.execute(
            select(func.count()).where(QuizProgress.is_completed == True)  # noqa: E712
        )
    ).scalar() or 0

    quiz_completion_rate = (
        round(min(100.0, (total_completed / total_started) * 100), 1)
        if total_started > 0
        else 0
    )

    return {
        "total_students": total_students,
        "avg_quiz_score": avg_quiz_score,
        "assignment_completion_rate": completion_rate,
        "top_performers": top_performers,
        "quiz_completion_rate": quiz_completion_rate,
    }
