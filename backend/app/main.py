from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.audit  # noqa: F401 — registers SQLAlchemy audit event listener
from app.config import settings
from app.database import async_session
from app.middleware.auth import AuthMiddleware
from app.routers import assignments, auth, books, progress, quiz, students, subjects
from app.seed import seed_super_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed super user
    async with async_session() as db:
        await seed_super_user(db)
    yield


app = FastAPI(title="EduTrack Self-Study Platform", lifespan=lifespan, redirect_slashes=False)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware)

# Routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(subjects.router)
app.include_router(books.router)
app.include_router(assignments.router)
app.include_router(progress.router)
app.include_router(quiz.router)

# Mount uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/")
async def health_check():
    return {"status": "ok"}
