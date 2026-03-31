import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.test import BookTest, TestSubmission
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def book_test(db: AsyncSession, book: Book) -> BookTest:
    t = BookTest(
        id=uuid.uuid4(),
        book_id=book.id,
        drive_link="https://drive.google.com/file/d/abc123/preview",
        instructions="Complete all questions.",
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


TEST_PAYLOAD = {
    "drive_link": "https://drive.google.com/file/d/xyz789/preview",
    "instructions": "Answer in 30 minutes.",
}


# ============================================================================
# GET TEST
# ============================================================================


@pytest.mark.asyncio
class TestGetBookTest:
    """GET /api/books/{book_id}/test"""

    async def test_get_existing(self, client: AsyncClient, tutor: User, book: Book, book_test: BookTest):
        resp = await client.get(
            f"/api/books/{book.id}/test",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(book_test.id)
        assert data["drive_link"] == book_test.drive_link
        assert data["instructions"] == book_test.instructions

    async def test_get_none(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.get(
            f"/api/books/{book.id}/test",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json() is None

    async def test_student_can_read(self, client: AsyncClient, student: User, book: Book, book_test: BookTest):
        resp = await client.get(
            f"/api/books/{book.id}/test",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == str(book_test.id)

    async def test_unauthenticated(self, client: AsyncClient, book: Book):
        resp = await client.get(f"/api/books/{book.id}/test")
        assert resp.status_code == 401


# ============================================================================
# CREATE / UPDATE TEST (POST)
# ============================================================================


@pytest.mark.asyncio
class TestCreateBookTest:
    """POST /api/books/{book_id}/test"""

    async def test_create_success(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.post(
            f"/api/books/{book.id}/test",
            json=TEST_PAYLOAD,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["drive_link"] == TEST_PAYLOAD["drive_link"]
        assert data["instructions"] == TEST_PAYLOAD["instructions"]
        assert data["book_id"] == str(book.id)

    async def test_create_minimal(self, client: AsyncClient, tutor: User, book: Book):
        """drive_link only, no instructions."""
        resp = await client.post(
            f"/api/books/{book.id}/test",
            json={"drive_link": "https://drive.google.com/file/d/min/preview"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        assert resp.json()["instructions"] is None

    async def test_create_upserts(self, client: AsyncClient, tutor: User, book: Book, book_test: BookTest):
        """POST on a book that already has a test should update it."""
        resp = await client.post(
            f"/api/books/{book.id}/test",
            json={"drive_link": "https://drive.google.com/file/d/new/preview"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        assert resp.json()["drive_link"] == "https://drive.google.com/file/d/new/preview"
        assert resp.json()["id"] == str(book_test.id)

    async def test_create_invalid_book(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            f"/api/books/{uuid.uuid4()}/test",
            json=TEST_PAYLOAD,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400
        assert "not found" in resp.json()["detail"].lower()

    async def test_create_student_forbidden(self, client: AsyncClient, student: User, book: Book):
        resp = await client.post(
            f"/api/books/{book.id}/test",
            json=TEST_PAYLOAD,
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_create_unauthenticated(self, client: AsyncClient, book: Book):
        resp = await client.post(
            f"/api/books/{book.id}/test",
            json=TEST_PAYLOAD,
        )
        assert resp.status_code == 401


# ============================================================================
# DELETE TEST
# ============================================================================


@pytest.mark.asyncio
class TestDeleteBookTest:
    """DELETE /api/books/{book_id}/test"""

    async def test_delete_success(self, client: AsyncClient, tutor: User, book: Book, book_test: BookTest):
        resp = await client.delete(
            f"/api/books/{book.id}/test",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 204

        # Verify gone
        resp = await client.get(
            f"/api/books/{book.id}/test",
            headers=tutor_headers(tutor),
        )
        assert resp.json() is None

    async def test_delete_not_found(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.delete(
            f"/api/books/{book.id}/test",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_delete_student_forbidden(self, client: AsyncClient, student: User, book: Book, book_test: BookTest):
        resp = await client.delete(
            f"/api/books/{book.id}/test",
            headers=student_headers(student),
        )
        assert resp.status_code == 403


# ============================================================================
# SUBMISSIONS (TUTOR)
# ============================================================================


@pytest.mark.asyncio
class TestListSubmissions:
    """GET /api/books/{book_id}/test/submissions"""

    async def test_list_empty(
        self, client: AsyncClient, tutor: User, book: Book, book_test: BookTest
    ):
        resp = await client.get(
            f"/api/books/{book.id}/test/submissions",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    async def test_list_with_assigned_student(
        self, client: AsyncClient, tutor: User, book: Book, book_test: BookTest,
        student: User, assignment: BookAssignment,
    ):
        """Assigned student appears in submissions even without submitting."""
        resp = await client.get(
            f"/api/books/{book.id}/test/submissions",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["student_id"] == str(student.id)
        assert data["items"][0]["submitted_at"] is None

    async def test_list_no_test(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.get(
            f"/api/books/{book.id}/test/submissions",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_list_student_forbidden(
        self, client: AsyncClient, student: User, book: Book, book_test: BookTest
    ):
        resp = await client.get(
            f"/api/books/{book.id}/test/submissions",
            headers=student_headers(student),
        )
        assert resp.status_code == 403


# ============================================================================
# STUDENT SUBMISSION FLOW
# ============================================================================


@pytest.mark.asyncio
class TestStudentSubmission:
    """Student test submission endpoints."""

    async def test_get_my_submission_not_submitted(
        self, client: AsyncClient, student: User, book: Book,
        book_test: BookTest, assignment: BookAssignment,
    ):
        resp = await client.get(
            f"/api/books/{book.id}/test/my-submission",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_submitted"] is False
        assert data["submitted_at"] is None

    async def test_submit_toggle_on(
        self, client: AsyncClient, student: User, book: Book,
        book_test: BookTest, assignment: BookAssignment,
    ):
        resp = await client.put(
            f"/api/books/{book.id}/test/submit",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_submitted"] is True
        assert data["submitted_at"] is not None

    async def test_submit_toggle_off(
        self, client: AsyncClient, student: User, book: Book,
        book_test: BookTest, assignment: BookAssignment,
    ):
        # Submit first
        await client.put(
            f"/api/books/{book.id}/test/submit",
            headers=student_headers(student),
        )

        # Toggle off
        resp = await client.put(
            f"/api/books/{book.id}/test/submit",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        assert resp.json()["has_submitted"] is False
        assert resp.json()["submitted_at"] is None

    async def test_submit_not_assigned(
        self, client: AsyncClient, student: User, book: Book, book_test: BookTest,
    ):
        """Student not assigned to book cannot submit."""
        resp = await client.put(
            f"/api/books/{book.id}/test/submit",
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_submit_no_test(
        self, client: AsyncClient, student: User, book: Book, assignment: BookAssignment,
    ):
        """Cannot submit when no test exists."""
        resp = await client.put(
            f"/api/books/{book.id}/test/submit",
            headers=student_headers(student),
        )
        assert resp.status_code == 404

    async def test_my_submission_not_assigned(
        self, client: AsyncClient, student: User, book: Book, book_test: BookTest,
    ):
        resp = await client.get(
            f"/api/books/{book.id}/test/my-submission",
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_tutor_cannot_submit(
        self, client: AsyncClient, tutor: User, book: Book, book_test: BookTest,
    ):
        resp = await client.put(
            f"/api/books/{book.id}/test/submit",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 403
