import uuid

import pytest
from httpx import AsyncClient

from app.models.book import Book
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


DRIVE_VIDEO_URL = "https://drive.google.com/file/d/abc123test/view"
DRIVE_THUMBNAIL_URL = "https://example.com/thumb.jpg"


@pytest.mark.asyncio
class TestCreateBook:
    """POST /api/subjects/{subject_id}/books"""

    async def test_create_book_success(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "New Book",
                "standard": "5",
                "sort_order": 1,
                "description": "A test book",
                "video_url": DRIVE_VIDEO_URL,
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Book"
        assert data["standard"] == "5"
        assert data["video_url"] == DRIVE_VIDEO_URL

    async def test_create_book_with_thumbnail(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "Book With Thumb",
                "standard": "3",
                "video_url": DRIVE_VIDEO_URL,
                "thumbnail_url": DRIVE_THUMBNAIL_URL,
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["thumbnail_url"] == DRIVE_THUMBNAIL_URL

    async def test_create_book_invalid_standard(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "Bad Standard",
                "standard": "99",
                "video_url": DRIVE_VIDEO_URL,
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_book_invalid_url_scheme(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "Bad URL",
                "standard": "5",
                "video_url": "javascript:alert(1)",
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_book_private_ip_url(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "Private IP",
                "standard": "5",
                "video_url": "https://127.0.0.1/video.mp4",
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400
        assert "private" in resp.json()["detail"].lower() or "internal" in resp.json()["detail"].lower()

    async def test_create_book_loopback_ipv6_url(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "IPv6 Loopback",
                "standard": "5",
                "video_url": "https://[::1]/video.mp4",
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_book_data_url(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "Data URL",
                "standard": "5",
                "video_url": "data:text/html,<h1>XSS</h1>",
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_book_invalid_thumbnail_url(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={
                "title": "Bad Thumb",
                "standard": "5",
                "video_url": DRIVE_VIDEO_URL,
                "thumbnail_url": "javascript:alert(1)",
            },
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_book_subject_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.post(
            f"/api/subjects/{fake_id}/books",
            json={"title": "Ghost", "standard": "5", "video_url": DRIVE_VIDEO_URL},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Subject not found"

    async def test_create_book_as_student(self, client: AsyncClient, student: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={"title": "Unauthorized", "standard": "5", "video_url": DRIVE_VIDEO_URL},
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_create_book_no_auth(self, client: AsyncClient, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={"title": "No Auth", "standard": "5", "video_url": DRIVE_VIDEO_URL},
        )
        assert resp.status_code in (401, 403)

    async def test_create_book_missing_title(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={"standard": "5", "video_url": DRIVE_VIDEO_URL},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422

    async def test_create_book_missing_video_url(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.post(
            f"/api/subjects/{subject.id}/books",
            json={"title": "No Video", "standard": "5"},
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

    async def test_get_book_no_progress_fields(self, client: AsyncClient, tutor: User, book: Book):
        """Verify progress fields are no longer in the response."""
        resp = await client.get(f"/api/books/{book.id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert "watch_percentage" not in data
        assert "last_position_seconds" not in data
        assert "completed" not in data
        assert "video_duration_seconds" not in data


@pytest.mark.asyncio
class TestUpdateBook:
    """PUT /api/books/{book_id}"""

    async def test_update_book_title(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            json={"title": "Updated Title"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    async def test_update_book_video_url(self, client: AsyncClient, tutor: User, book: Book):
        new_url = "https://drive.google.com/file/d/newvideo/view"
        resp = await client.put(
            f"/api/books/{book.id}",
            json={"video_url": new_url},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["video_url"] == new_url

    async def test_update_book_invalid_video_url(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            json={"video_url": "ftp://evil.com/video.mp4"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_update_book_invalid_thumbnail_url(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            json={"thumbnail_url": "javascript:void(0)"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_update_book_invalid_standard(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            json={"standard": "99"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_update_book_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.put(
            f"/api/books/{fake_id}",
            json={"title": "Ghost"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_update_book_as_student(self, client: AsyncClient, student: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}",
            json={"title": "Hacked"},
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
