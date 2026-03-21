import asyncio
import os
import uuid
from typing import AsyncGenerator

# Set env vars BEFORE importing app modules
_test_upload_dir = os.path.join(os.path.dirname(__file__), "test_uploads")
os.environ["UPLOAD_DIR"] = _test_upload_dir
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.makedirs(_test_upload_dir, exist_ok=True)
os.makedirs(os.path.join(_test_upload_dir, "videos"), exist_ok=True)
os.makedirs(os.path.join(_test_upload_dir, "thumbnails"), exist_ok=True)

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.models.user import User, UserType
from app.models.subject import Subject
from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.watch_progress import WatchProgress
from app.utils.jwt import create_token
from app.utils.password import hash_password

# Use SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def app():
    """Create a FastAPI app with overridden dependencies."""
    from app.main import app as _app
    _app.dependency_overrides[get_db] = override_get_db
    yield _app
    _app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def tutor(db: AsyncSession) -> User:
    """Create and return a tutor user."""
    user = User(
        id=uuid.uuid4(),
        login_id="tutor@test.com",
        name="Test Tutor",
        email="tutor@test.com",
        password_hash=hash_password("Tutor@123"),
        user_type=UserType.tutor,
        must_change_password=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def student(db: AsyncSession, tutor: User) -> User:
    """Create and return a student user."""
    user = User(
        id=uuid.uuid4(),
        login_id="student@test.com",
        name="Test Student",
        email="student@test.com",
        phone="1234567890",
        password_hash=hash_password("Student@123"),
        user_type=UserType.student,
        standard="5",
        must_change_password=False,
        created_by=tutor.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def student_must_change(db: AsyncSession, tutor: User) -> User:
    """Create a student that must change password."""
    user = User(
        id=uuid.uuid4(),
        login_id="newstudent@test.com",
        name="New Student",
        email="newstudent@test.com",
        password_hash=hash_password("Stu@temp"),
        user_type=UserType.student,
        must_change_password=True,
        created_by=tutor.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def subject(db: AsyncSession, tutor: User) -> Subject:
    """Create and return a subject."""
    subj = Subject(
        id=uuid.uuid4(),
        name="Mathematics",
        icon="calculator",
        created_by=tutor.id,
    )
    db.add(subj)
    await db.commit()
    await db.refresh(subj)
    return subj


@pytest_asyncio.fixture
async def book(db: AsyncSession, subject: Subject, tutor: User) -> Book:
    """Create and return a book."""
    b = Book(
        id=uuid.uuid4(),
        title="Algebra Basics",
        description="Introduction to algebra",
        video_url="/uploads/videos/test.mp4",
        video_duration_seconds=120.0,
        standard="5",
        sort_order=1,
        subject_id=subject.id,
        created_by=tutor.id,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


@pytest_asyncio.fixture
async def assignment(db: AsyncSession, book: Book, student: User, tutor: User) -> BookAssignment:
    """Create a book assignment."""
    a = BookAssignment(
        id=uuid.uuid4(),
        book_id=book.id,
        student_id=student.id,
        assigned_by=tutor.id,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest_asyncio.fixture
async def watch_progress(db: AsyncSession, student: User, book: Book, assignment: BookAssignment) -> WatchProgress:
    """Create watch progress for a student."""
    from datetime import datetime
    wp = WatchProgress(
        id=uuid.uuid4(),
        student_id=student.id,
        book_id=book.id,
        watch_percentage=50.0,
        last_position_seconds=60.0,
        completed=False,
        last_watched_at=datetime.utcnow(),
    )
    db.add(wp)
    await db.commit()
    await db.refresh(wp)
    return wp


def tutor_token(tutor: User) -> str:
    return create_token(str(tutor.id), "tutor")


def student_token(student: User) -> str:
    return create_token(str(student.id), "student")


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def tutor_headers(tutor: User) -> dict:
    return auth_header(tutor_token(tutor))


def student_headers(student: User) -> dict:
    return auth_header(student_token(student))
