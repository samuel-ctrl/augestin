import io
import uuid

import pytest
from httpx import AsyncClient

from app.models.book import Book
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


def make_video_file():
    """Create a minimal fake video file."""
    content = b"\x00" * 1024  # 1KB fake video
    return ("video", ("test.mp4", io.BytesIO(content), "video/mp4"))


def make_thumbnail_file():
    """Create a minimal fake thumbnail file."""
    content = b"\x00" * 512
    return ("thumbnail", ("test.jpg", io.BytesIO(content), "image/jpeg"))


@pytest.mark.asyncio
class TestCreateBook:
    """POST /api/subjects/{subject_id}/books"""

    async def test_create_book_success(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={
                "title": "New Book",
                "standard": "5",
                "sort_order": "1",
                "video_duration_seconds": "120",
                "description": "A test book",
            },
            files=[make_video_file()],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Book"
        assert data["standard"] == "5"
        assert data["video_url"].startswith("/uploads/videos/")

    async def test_create_book_with_thumbnail(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={
                "title": "Book With Thumb",
                "standard": "3",
            },
            files=[make_video_file(), make_thumbnail_file()],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["thumbnail_url"] is not None

    async def test_create_book_invalid_standard(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={
                "title": "Bad Standard",
                "standard": "99",
            },
            files=[make_video_file()],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_book_invalid_video_format(self, client: AsyncClient, tutor: User, subject: Subject):
        content = b"\x00" * 100
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={
                "title": "Bad Video",
                "standard": "5",
            },
            files=[("video", ("test.txt", io.BytesIO(content), "text/plain"))],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400
        assert "Invalid video format" in resp.json()["detail"]

    async def test_create_book_invalid_thumbnail_format(self, client: AsyncClient, tutor: User, subject: Subject):
        content = b"\x00" * 100
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={
                "title": "Bad Thumb",
                "standard": "5",
            },
            files=[
                make_video_file(),
                ("thumbnail", ("test.txt", io.BytesIO(content), "text/plain")),
            ],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400
        assert "Invalid thumbnail format" in resp.json()["detail"]

    async def test_create_book_subject_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.post(
            f"/api/subjects/{fake_id}/books",
            data={"title": "Ghost", "standard": "5"},
            files=[make_video_file()],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Subject not found"

    async def test_create_book_as_student(self, client: AsyncClient, student: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={"title": "Unauthorized", "standard": "5"},
            files=[make_video_file()],
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_create_book_no_auth(self, client: AsyncClient, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={"title": "No Auth", "standard": "5"},
            files=[make_video_file()],
        )
        assert resp.status_code in (401, 403)

    async def test_create_book_missing_title(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={"standard": "5"},
            files=[make_video_file()],
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422

    async def test_create_book_missing_video(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            data={"title": "No Video", "standard": "5"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestListBooks:
    """GET /api/subjects/{subject_id}/books"""

    async def test_list_books_as_tutor(self, client: AsyncClient, tutor: User, subject: Subject, book: Book):
        resp = await client.get(f"/api/subjects/{subject.id}/books",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    async def test_list_books_as_student_no_assignments(self, client: AsyncClient, student: User, subject: Subject, book: Book):
        resp = await client.get(f"/api/subjects/{subject.id}/books",
                                headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0  # no assignment yet

    async def test_list_books_as_student_with_assignment(self, client: AsyncClient, student: User, subject: Subject, book: Book, assignment):
        resp = await client.get(f"/api/subjects/{subject.id}/books",
                                headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_books_subject_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.get(f"/api/subjects/{fake_id}/books",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_list_books_search(self, client: AsyncClient, tutor: User, subject: Subject, book: Book):
        resp = await client.get(f"/api/subjects/{subject.id}/books?search=Algebra",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_books_filter_standard(self, client: AsyncClient, tutor: User, subject: Subject, book: Book):
        resp = await client.get(f"/api/subjects/{subject.id}/books?standard=5",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_books_pagination(self, client: AsyncClient, tutor: User, subject: Subject, book: Book):
        resp = await client.get(f"/api/subjects/{subject.id}/books?page=1&page_size=1",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["page_size"] == 1


@pytest.mark.asyncio
class TestGetBook:
    """GET /api/books/{book_id}"""

    async def test_get_book_as_tutor(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.get(f"/api/books/{book.id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["title"] == "Algebra Basics"

    async def test_get_book_as_assigned_student(self, client: AsyncClient, student: User, book: Book, assignment):
        resp = await client.get(f"/api/books/{book.id}",
                                headers=student_headers(student))
        assert resp.status_code == 200

    async def test_get_book_as_unassigned_student(self, client: AsyncClient, student: User, book: Book):
        resp = await client.get(f"/api/books/{book.id}",
                                headers=student_headers(student))
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Book not assigned to you"

    async def test_get_book_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.get(f"/api/books/{fake_id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_get_book_with_progress(self, client: AsyncClient, student: User, book: Book, assignment, watch_progress):
        resp = await client.get(f"/api/books/{book.id}",
                                headers=student_headers(student))
        assert resp.status_code == 200
        data = resp.json()
        assert data["watch_percentage"] == 50.0


@pytest.mark.asyncio
class TestUpdateBook:
    """PUT /api/books/{book_id}"""

    async def test_update_book_title(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            data={"title": "Updated Title"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    async def test_update_book_invalid_standard(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            data={"standard": "99"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_update_book_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.put(
            f"/api/books/{fake_id}",
            data={"title": "Ghost"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_update_book_as_student(self, client: AsyncClient, student: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            data={"title": "Hacked"},
            headers=student_headers(student),
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestDeleteBook:
    """DELETE /api/books/{book_id}"""

    async def test_delete_book_success(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.delete(f"/api/books/{book.id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 204

        resp2 = await client.get(f"/api/books/{book.id}",
                                 headers=tutor_headers(tutor))
        assert resp2.status_code == 404

    async def test_delete_book_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.delete(f"/api/books/{fake_id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_delete_book_as_student(self, client: AsyncClient, student: User, book: Book):
        resp = await client.delete(f"/api/books/{book.id}",
                                   headers=student_headers(student))
        assert resp.status_code == 403
