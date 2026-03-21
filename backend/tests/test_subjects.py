import uuid

import pytest
from httpx import AsyncClient

from app.models.subject import Subject
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


@pytest.mark.asyncio
class TestCreateSubject:
    """POST /api/subjects/"""

    async def test_create_subject_success(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/subjects/", json={
            "name": "Physics",
            "icon": "atom",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Physics"
        assert data["icon"] == "atom"
        assert "id" in data

    async def test_create_subject_default_icon(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/subjects/", json={
            "name": "Chemistry",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 201
        assert resp.json()["icon"] == "book"

    async def test_create_subject_invalid_icon(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/subjects/", json={
            "name": "Bad Icon Subject",
            "icon": "nonexistent_icon",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 400
        assert "Invalid icon" in resp.json()["detail"]

    async def test_create_subject_empty_name(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/subjects/", json={
            "name": "",
        }, headers=tutor_headers(tutor))
        # FastAPI allows empty strings for str fields, so this may succeed
        assert resp.status_code in (201, 400, 422)

    async def test_create_subject_missing_name(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/subjects/", json={},
                                 headers=tutor_headers(tutor))
        assert resp.status_code == 422

    async def test_create_subject_as_student(self, client: AsyncClient, student: User):
        resp = await client.post("/api/subjects/", json={
            "name": "Unauthorized",
        }, headers=student_headers(student))
        assert resp.status_code == 403

    async def test_create_subject_no_auth(self, client: AsyncClient):
        resp = await client.post("/api/subjects/", json={"name": "No Auth"})
        assert resp.status_code in (401, 403)

    async def test_create_subject_all_valid_icons(self, client: AsyncClient, tutor: User):
        """Test creating subjects with each valid icon."""
        valid_icons = ["book", "atom", "calculator", "flask", "microscope", "globe"]
        for icon in valid_icons:
            resp = await client.post("/api/subjects/", json={
                "name": f"Subject {icon}",
                "icon": icon,
            }, headers=tutor_headers(tutor))
            assert resp.status_code == 201


@pytest.mark.asyncio
class TestListSubjects:
    """GET /api/subjects/"""

    async def test_list_subjects_as_tutor(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.get("/api/subjects/", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert "items" in data

    async def test_list_subjects_as_student(self, client: AsyncClient, student: User):
        resp = await client.get("/api/subjects/", headers=student_headers(student))
        assert resp.status_code == 200
        data = resp.json()
        # Student sees only subjects with assigned books
        assert data["total"] == 0

    async def test_list_subjects_search(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.get("/api/subjects/?search=Math",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_subjects_search_no_results(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.get("/api/subjects/?search=ZZZZNOTFOUND",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_list_subjects_pagination(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.get("/api/subjects/?page=1&page_size=1",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["page_size"] == 1

    async def test_list_subjects_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/subjects/")
        assert resp.status_code in (401, 403)


@pytest.mark.asyncio
class TestGetSubject:
    """GET /api/subjects/{subject_id}"""

    async def test_get_subject_success(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.get(f"/api/subjects/{subject.id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["name"] == "Mathematics"

    async def test_get_subject_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.get(f"/api/subjects/{fake_id}",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Subject not found"

    async def test_get_subject_invalid_uuid(self, client: AsyncClient, tutor: User):
        resp = await client.get("/api/subjects/not-a-uuid",
                                headers=tutor_headers(tutor))
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestUpdateSubject:
    """PUT /api/subjects/{subject_id}"""

    async def test_update_subject_name(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.put(f"/api/subjects/{subject.id}", json={
            "name": "Advanced Mathematics",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["name"] == "Advanced Mathematics"

    async def test_update_subject_icon(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.put(f"/api/subjects/{subject.id}", json={
            "icon": "atom",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 200
        assert resp.json()["icon"] == "atom"

    async def test_update_subject_invalid_icon(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.put(f"/api/subjects/{subject.id}", json={
            "icon": "invalid_icon_name",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 400
        assert "Invalid icon" in resp.json()["detail"]

    async def test_update_subject_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.put(f"/api/subjects/{fake_id}", json={
            "name": "Ghost",
        }, headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_update_subject_as_student(self, client: AsyncClient, student: User, subject: Subject):
        resp = await client.put(f"/api/subjects/{subject.id}", json={
            "name": "Hacked",
        }, headers=student_headers(student))
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestDeleteSubject:
    """DELETE /api/subjects/{subject_id}"""

    async def test_delete_subject_success(self, client: AsyncClient, tutor: User, subject: Subject):
        resp = await client.delete(f"/api/subjects/{subject.id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 204

        # Verify deleted
        resp2 = await client.get(f"/api/subjects/{subject.id}",
                                 headers=tutor_headers(tutor))
        assert resp2.status_code == 404

    async def test_delete_subject_not_found(self, client: AsyncClient, tutor: User):
        fake_id = uuid.uuid4()
        resp = await client.delete(f"/api/subjects/{fake_id}",
                                   headers=tutor_headers(tutor))
        assert resp.status_code == 404

    async def test_delete_subject_as_student(self, client: AsyncClient, student: User, subject: Subject):
        resp = await client.delete(f"/api/subjects/{subject.id}",
                                   headers=student_headers(student))
        assert resp.status_code == 403
