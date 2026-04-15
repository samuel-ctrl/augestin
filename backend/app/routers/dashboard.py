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

    # Average quiz score (completed quizzes only)
    avg_score = (
        await db.execute(
            select(func.avg(QuizProgress.score_percentage)).where(
                QuizProgress.is_completed == True
            )
        )
    ).scalar()
    avg_quiz_score = round(avg_score, 1) if avg_score is not None else 0

    # Assignment completion rate: completed quiz progress / total assignments
    total_assignments = (
        await db.execute(select(func.count()).select_from(BookAssignment))
    ).scalar() or 0

    completed_assignments = (
        await db.execute(
            select(func.count()).select_from(
                select(BookAssignment)
                .join(
                    QuizProgress,
                    (QuizProgress.student_id == BookAssignment.student_id)
                    & (QuizProgress.book_id == BookAssignment.book_id)
                    & (QuizProgress.is_completed == True),
                )
                .subquery()
            )
        )
    ).scalar() or 0

    completion_rate = (
        round(min(100.0, (completed_assignments / total_assignments) * 100), 1)
        if total_assignments > 0
        else 0
    )

    # Top performers: students with average completed quiz score >= 80%
    top_performers_q = (
        select(func.count())
        .select_from(
            select(QuizProgress.student_id)
            .where(QuizProgress.is_completed == True)
            .group_by(QuizProgress.student_id)
            .having(func.avg(QuizProgress.score_percentage) >= 80)
            .subquery()
        )
    )
    top_performers = (await db.execute(top_performers_q)).scalar() or 0

    # Quiz completion rate (started vs completed) as proxy for on-time
    total_started = (
        await db.execute(
            select(func.count()).where(QuizProgress.is_started == True)
        )
    ).scalar() or 0

    total_completed = (
        await db.execute(
            select(func.count()).where(QuizProgress.is_completed == True)
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
