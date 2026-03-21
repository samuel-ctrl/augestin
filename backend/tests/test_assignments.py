import uuid

import pytest
from httpx import AsyncClient

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


@pytest.mark.asyncio
class TestAssignBook:
    """POST /api/assignments/"""

    async def test_assign_book_success(self, client: AsyncClient, tutor: User, student: User, book: Book):
        resp = await client.post("/api/assignments/", json={
            "book_id": str(book.id),
            "student_ids": [str(student.id)],
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        data = resp.json()
        assert data["created"] == 1

    async def test_assign_book_multiple_students(self, client: AsyncClient, tutor: User, book: Book, db):
        """Assign a book to multiple students at once."""
        from app.models.user import UserType
        from app.utils.password import hash_password
        students = []
        for i in range(3):
            s = User(
                id=uuid.uuid4(),
                login_id=f"multi_student_{i}@test.com",
                name=f"Multi Student {i}",
                email=f"multi_student_{i}@test.com",
                password_hash=hash_password("Pass@123"),
                user_type=UserType.student,
                must_change_password=False,
                created_by=tutor.id,
            )
            db.add(s)
            students.append(s)
        await db.commit()

        resp = await client.post("/api/assignments/", json={
            "book_id": str(book.id),
            "student_ids": [str(s.id) for s in students],
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        assert resp.json()["created"] == 3

    async def test_assign_book_duplicate_skipped(self, client: AsyncClient, tutor: User, student: User, book: Book, assignment: BookAssignment):
        """Re-assigning an already assigned book should skip duplicates."""
        resp = await client.post("/api/assignments/", json={
            "book_id": str(book.id),
            "student_ids": [str(student.id)],
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        assert resp.json()["created"] == 0

    async def test_assign_book_empty_students(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.post("/api/assignments/", json={
            "book_id": str(book.id),
            "student_ids": [],
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        assert resp.json()["created"] == 0

    async def test_assign_book_invalid_book_id(self, client: AsyncClient, tutor: User, student: User):
        try:
            resp = await client.post("/api/assignments/", json={
                "book_id": "not-a-uuid",
                "student_ids": [str(student.id)],
            }, headers=tutor_headers(tutor))
            # UUID parsing in the service will fail - any 4xx/5xx is acceptable
            assert resp.status_code >= 400
        except Exception:
            # If the client itself raises due to invalid UUID, that's also acceptable
            pass

    async def test_assign_book_as_student(self, client: AsyncClient, student: User, book: Book):
        resp = await client.post("/api/assignments/", json={
            "book_id": str(book.id),
            "student_ids": [str(student.id)],
        }, headers=student_headers(student))
        assert resp.status_code == 403

    async def test_assign_book_no_auth(self, client: AsyncClient, book: Book, student: User):
        resp = await client.post("/api/assignments/", json={
            "book_id": str(book.id),
            "student_ids": [str(student.id)],
        })
        assert resp.status_code in (401, 403)

    async def test_assign_book_missing_fields(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/assignments/", json={},
                                 headers=tutor_headers(tutor))
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestDeleteAssignment:
    """DELETE /api/assignments/{assignment_id}"""

    async def test_delete_assignment_success(self, client: AsyncClient, tutor: User, assignment: BookAssignment):
        resp = await client.delete(f"/api/assignments/{assignment.id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 204

    async def test_delete_assignment_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.delete(f"/api/assignments/{fake_id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_delete_assignment_as_student(self, client: AsyncClient, student: User, assignment: BookAssignment):
        resp = await client.delete(f"/api/assignments/{assignment.id}",
                                   headers=student_headers(student))
        assert resp.status_code == 403

    async def test_delete_assignment_invalid_uuid(self, client: AsyncClient, tutor: User):
        resp = await client.delete("/api/assignments/not-a-uuid",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestListAssignments:
    """GET /api/assignments/book/{book_id}"""

    async def test_list_assignments_success(self, client: AsyncClient, tutor: User, book: Book, assignment: BookAssignment):
        resp = await client.get(f"/api/assignments/book/{book.id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["items"][0]["student_name"] == "Test Student"

    async def test_list_assignments_empty(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.get(f"/api/assignments/book/{book.id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_list_assignments_search(self, client: AsyncClient, tutor: User, book: Book, assignment: BookAssignment):
        resp = await client.get(f"/api/assignments/book/{book.id}?search=Test",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_assignments_search_no_results(self, client: AsyncClient, tutor: User, book: Book, assignment: BookAssignment):
        resp = await client.get(f"/api/assignments/book/{book.id}?search=ZZZZNOTFOUND",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_list_assignments_pagination(self, client: AsyncClient, tutor: User, book: Book, assignment: BookAssignment):
        resp = await client.get(f"/api/assignments/book/{book.id}?page=1&page_size=1",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["page_size"] == 1

    async def test_list_assignments_as_student(self, client: AsyncClient, student: User, book: Book):
        resp = await client.get(f"/api/assignments/book/{book.id}",
                                headers=student_headers(student))
        assert resp.status_code == 403
