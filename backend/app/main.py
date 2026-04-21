import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.audit  # noqa: F401 — registers SQLAlchemy audit event listener
from app.config import settings
from app.database import async_session
from app.middleware.activity_log import ActivityLogMiddleware
from app.middleware.auth import AuthMiddleware
from app.routers import activity_logs, admin, assignments, auth, books, dashboard, doubts, live_quiz, lookups, notifications, progress, quiz, quiz_sets, recap, settings as settings_router, students, subjects, test, test_sets, ws

logger = logging.getLogger(__name__)


async def run_migrations():
    import asyncio
    from sqlalchemy import create_engine, text
    from alembic.config import Config
    from alembic import command

    def _migrate():
        alembic_cfg = Config("alembic.ini")
        # Use a PostgreSQL advisory lock to prevent concurrent migration runs
        # across multiple replicas. Lock key 1 is arbitrary but consistent.
        db_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2", 1)
        try:
            sync_engine = create_engine(db_url)
            with sync_engine.connect() as conn:
                conn.execute(text("SELECT pg_advisory_lock(1)"))
                try:
                    command.upgrade(alembic_cfg, "head")
                finally:
                    conn.execute(text("SELECT pg_advisory_unlock(1)"))
                    conn.commit()
            sync_engine.dispose()
        except Exception:
            # Fallback for non-PostgreSQL (e.g., SQLite in tests)
            logger.debug("Advisory lock unavailable, running migrations directly")
            command.upgrade(alembic_cfg, "head")

    await asyncio.to_thread(_migrate)
    logger.info("Database migrations applied successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations()
    yield


app = FastAPI(title="EduTrack Self-Study Platform", lifespan=lifespan, redirect_slashes=False)

# Order matters. Starlette's add_middleware prepends to user_middleware and
# build_middleware_stack iterates in reverse, so the LAST added middleware
# ends up OUTERMOST.
#   added order:   Auth, ActivityLog, CORS
#   runtime order: CORS (outermost) -> ActivityLog -> Auth -> router
# CORS must be outermost so error responses from Auth (e.g. 401) still get
# CORS headers — otherwise the browser blocks the body and the frontend
# can't distinguish a real 401 from a network failure.
# ActivityLog reads request.state.user after call_next, which Auth has
# populated by then regardless of relative order.
app.add_middleware(AuthMiddleware)
app.add_middleware(ActivityLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — books and quiz_sets before students so /api/students/books
# and /api/students/quiz-sets don't get matched by students' /{student_id} route
app.include_router(auth.router)
app.include_router(lookups.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(books.router)
app.include_router(quiz_sets.router)
app.include_router(live_quiz.router)
app.include_router(test_sets.router)
app.include_router(doubts.router)
app.include_router(students.router)
app.include_router(subjects.router)
app.include_router(assignments.router)
app.include_router(progress.router)
app.include_router(quiz.router)
app.include_router(recap.router)
app.include_router(test.router)
app.include_router(settings_router.router)
app.include_router(ws.router)
app.include_router(admin.router)
app.include_router(activity_logs.router)


@app.get("/")
async def health_check():
    return {"status": "ok"}
