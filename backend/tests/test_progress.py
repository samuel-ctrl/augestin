import uuid

import pytest
from httpx import AsyncClient

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.user import User
from app.models.watch_progress import WatchProgress
from tests.conftest import student_headers, tutor_headers


@pytest.mark.asyncio
class TestUpdateProgress:
    """PUT /api/progress/{book_id}"""

    async def test_update_progress_success(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 25.0,
            "last_position_seconds": 30.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        data = resp.json()
        assert data["watch_percentage"] == 25.0
        assert data["last_position_seconds"] == 30.0
        assert data["completed"] is False

    async def test_update_progress_auto_complete(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        """Progress >= 90% should auto-complete."""
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 95.0,
            "last_position_seconds": 114.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["completed"] is True

    async def test_update_progress_exactly_90(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        """Progress == 90% should auto-complete."""
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 90.0,
            "last_position_seconds": 108.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["completed"] is True

    async def test_update_progress_below_90(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 89.9,
            "last_position_seconds": 107.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["completed"] is False

    async def test_update_progress_clamp_over_100(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        """Percentage > 100 should be clamped to 100."""
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 150.0,
            "last_position_seconds": 120.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["watch_percentage"] == 100.0

    async def test_update_progress_clamp_negative(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        """Negative percentage should be clamped to 0."""
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": -10.0,
            "last_position_seconds": 0.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["watch_percentage"] == 0.0

    async def test_update_progress_upsert(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        """Second update should update existing progress, not create duplicate."""
        await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 10.0,
            "last_position_seconds": 12.0,
        }, headers=student_headers(student))

        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 50.0,
            "last_position_seconds": 60.0,
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["watch_percentage"] == 50.0

    async def test_update_progress_not_assigned(self, client: AsyncClient, student: User, book: Book):
        """Should fail if book is not assigned to student."""
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 10.0,
            "last_position_seconds": 12.0,
        }, headers=student_headers(student))
        assert resp.status_code == 400
        assert "not assigned" in resp.json()["detail"]

    async def test_update_progress_nonexistent_book(self, client: AsyncClient, student: User):
        fake_id = uuid.uuid4()
        resp = await client.put(f"/api/progress/{fake_id}", json={
            "watch_percentage": 10.0,
            "last_position_seconds": 12.0,
        }, headers=student_headers(student))
        assert resp.status_code == 400

    async def test_update_progress_as_tutor(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 10.0,
            "last_position_seconds": 12.0,
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 403

    async def test_update_progress_no_auth(self, client: AsyncClient, book: Book):
        resp = await client.put(f"/api/progress/{book.id}", json={
            "watch_percentage": 10.0,
            "last_position_seconds": 12.0,
        })
        assert resp.status_code in (401, 403)

    async def test_update_progress_missing_fields(self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment):
        resp = await client.put(f"/api/progress/{book.id}", json={},
                                headers=student_headers(student))
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestResumeBook:
    """GET /api/progress/resume"""

    async def test_resume_no_progress(self, client: AsyncClient, student: User):
        resp = await client.get("/api/progress/resume",
                                headers=student_headers(student))
        assert resp.status_code == 200
        # No progress yet - should return null
        assert resp.json() is None

    async def test_resume_with_progress(self, client: AsyncClient, student: User, book: Book, subject, watch_progress: WatchProgress):
        resp = await client.get("/api/progress/resume",
                                headers=student_headers(student))
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert data["book_id"] == str(book.id)
        assert data["book_title"] == "Algebra Basics"
        assert data["subject_name"] == "Mathematics"
        assert data["watch_percentage"] == 50.0

    async def test_resume_as_tutor(self, client: AsyncClient, tutor: User):
        resp = await client.get("/api/progress/resume",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 403

    async def test_resume_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/progress/resume")
        assert resp.status_code in (401, 403)


@pytest.mark.asyncio
class TestHealthCheck:
    """GET /"""

    async def test_health_check(self, client: AsyncClient):
        resp = await client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
