import uuid

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import student_headers, tutor_headers


@pytest.mark.asyncio
class TestCreateStudent:
    """POST /api/students/"""

    async def test_create_student_success(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/students/", json={
            "name": "John Doe",
            "email": "john@test.com",
            "phone": "9876543210",
            "standard": "5",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "John Doe"
        assert "login_id" in data
        assert "password" in data
        assert len(data["password"]) > 0

    async def test_create_student_name_only(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/students/", json={
            "name": "Jane Doe",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Jane Doe"
        assert data["login_id"].startswith("STU-")

    async def test_create_student_invalid_standard(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/students/", json={
            "name": "Bad Standard",
            "standard": "99",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 400
        assert "Invalid standard" in resp.json()["detail"]

    async def test_create_student_missing_name(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/students/", json={},
                                 headers=tutor_headers(tutor))
        assert resp.status_code == 422

    async def test_create_student_as_student_forbidden(self, client: AsyncClient, student: User):
        resp = await client.post("/api/students/", json={
            "name": "Unauthorized",
        }, headers=student_headers(student))
        assert resp.status_code == 403

    async def test_create_student_no_auth(self, client: AsyncClient):
        resp = await client.post("/api/students/", json={"name": "No Auth"})
        assert resp.status_code in (401, 403)

    async def test_create_student_duplicate_email(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.post("/api/students/", json={
            "name": "Duplicate Email",
            "email": "student@test.com",  # already exists
        }, headers=tutor_headers(tutor))
        # Should fail due to unique constraint - may return 400, 409, or 500
        assert resp.status_code >= 400

    async def test_create_student_all_standards(self, client: AsyncClient, tutor: User):
        """Test creating students with each valid standard."""
        for std in ["1", "6", "12"]:
            resp = await client.post("/api/students/", json={
                "name": f"Student Std {std}",
                "standard": std,
            }, headers=tutor_headers(tutor))
            assert resp.status_code == 201


@pytest.mark.asyncio
class TestListStudents:
    """GET /api/students/"""

    async def test_list_students(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert data["total"] >= 1

    async def test_list_students_pagination(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/?page=1&page_size=1",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["page_size"] == 1
        assert len(data["items"]) <= 1

    async def test_list_students_search(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/?search=Test",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_students_search_no_results(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/?search=ZZZZNOTFOUND",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_list_students_filter_standard(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/?standard=5",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_students_sort(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/?sort_by=name&sort_order=asc",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200

    async def test_list_students_invalid_sort(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get("/api/students/?sort_by=invalid_col",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200  # falls back to default sort

    async def test_list_students_as_student_forbidden(self, client: AsyncClient, student: User):
        resp = await client.get("/api/students/", headers=student_headers(student))
        assert resp.status_code == 403

    async def test_list_students_page_zero(self, client: AsyncClient, tutor: User):
        resp = await client.get("/api/students/?page=0", headers=tutor_headers(tutor))
        assert resp.status_code == 422  # ge=1 validation


@pytest.mark.asyncio
class TestGetStudent:
    """GET /api/students/{student_id}"""

    async def test_get_student_success(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get(f"/api/students/{student.id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Student"
        assert data["email"] == "student@test.com"

    async def test_get_student_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.get(f"/api/students/{fake_id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Student not found"

    async def test_get_student_invalid_uuid(self, client: AsyncClient, tutor: User):
        resp = await client.get("/api/students/not-a-uuid",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestUpdateStudent:
    """PUT /api/students/{student_id}"""

    async def test_update_student_name(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.put(f"/api/students/{student.id}", json={
            "name": "Updated Name",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    async def test_update_student_standard(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.put(f"/api/students/{student.id}", json={
            "standard": "10",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["standard"] == "10"

    async def test_update_student_invalid_standard(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.put(f"/api/students/{student.id}", json={
            "standard": "99",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 400

    async def test_update_student_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.put(f"/api/students/{fake_id}", json={
            "name": "Ghost",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_update_student_as_student(self, client: AsyncClient, student: User):
        resp = await client.put(f"/api/students/{student.id}", json={
            "name": "Hacked",
        }, headers=student_headers(student))
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestDeleteStudent:
    """DELETE /api/students/{student_id}"""

    async def test_delete_student_success(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.delete(f"/api/students/{student.id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 204

        # Verify deleted
        resp2 = await client.get(f"/api/students/{student.id}",
                                 headers=tutor_headers(tutor))
        assert resp2.status_code == 404

    async def test_delete_student_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.delete(f"/api/students/{fake_id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_delete_student_as_student(self, client: AsyncClient, student: User):
        resp = await client.delete(f"/api/students/{student.id}",
                                   headers=student_headers(student))
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestResetPassword:
    """POST /api/students/{student_id}/reset-password"""

    async def test_reset_password_success(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.post(f"/api/students/{student.id}/reset-password",
                                 headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert "login_id" in data
        assert "password" in data
        assert len(data["password"]) > 0

        # Verify new password works
        login_resp = await client.post("/api/auth/login", json={
            "login_id": data["login_id"],
            "password": data["password"],
        })
        assert login_resp.status_code == 200

    async def test_reset_password_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.post(f"/api/students/{fake_id}/reset-password",
                                 headers=tutor_headers(tutor))
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestStudentProgress:
    """GET /api/students/{student_id}/progress"""

    async def test_get_progress_empty(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.get(f"/api/students/{student.id}/progress",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_get_progress_with_data(self, client: AsyncClient, tutor: User, student: User, watch_progress):
        resp = await client.get(f"/api/students/{student.id}/progress",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["items"][0]["watch_percentage"] == 50.0

    async def test_get_progress_student_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.get(f"/api/students/{fake_id}/progress",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 404
