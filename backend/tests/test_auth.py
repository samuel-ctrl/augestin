import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header, student_headers, student_token, tutor_headers, tutor_token


@pytest.mark.asyncio
class TestLogin:
    """POST /api/auth/login"""

    async def test_login_tutor_success(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/auth/login", json={
            "login_id": "tutor@test.com",
            "password": "Tutor@123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["login_id"] == "tutor@test.com"
        assert data["user"]["user_type"] == "tutor"

    async def test_login_student_success(self, client: AsyncClient, student: User):
        resp = await client.post("/api/auth/login", json={
            "login_id": "student@test.com",
            "password": "Student@123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["user_type"] == "student"

    async def test_login_wrong_password(self, client: AsyncClient, tutor: User):
        resp = await client.post("/api/auth/login", json={
            "login_id": "tutor@test.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid credentials"

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/api/auth/login", json={
            "login_id": "nobody@test.com",
            "password": "Whatever@123",
        })
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid credentials"

    async def test_login_empty_fields(self, client: AsyncClient):
        resp = await client.post("/api/auth/login", json={
            "login_id": "",
            "password": "",
        })
        assert resp.status_code == 401

    async def test_login_missing_fields(self, client: AsyncClient):
        resp = await client.post("/api/auth/login", json={})
        assert resp.status_code == 422

    async def test_login_no_body(self, client: AsyncClient):
        resp = await client.post("/api/auth/login")
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestMe:
    """GET /api/auth/me"""

    async def test_me_tutor(self, client: AsyncClient, tutor: User):
        resp = await client.get("/api/auth/me", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["login_id"] == "tutor@test.com"
        assert data["user_type"] == "tutor"

    async def test_me_student(self, client: AsyncClient, student: User):
        resp = await client.get("/api/auth/me", headers=student_headers(student))
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_type"] == "student"
        assert data["standard"] == "5"

    async def test_me_no_token(self, client: AsyncClient):
        resp = await client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    async def test_me_invalid_token(self, client: AsyncClient):
        resp = await client.get("/api/auth/me", headers=auth_header("invalid.token.here"))
        assert resp.status_code == 401

    async def test_me_expired_token(self, client: AsyncClient):
        # Malformed JWT
        resp = await client.get("/api/auth/me", headers=auth_header("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid"))
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestChangePassword:
    """PUT /api/auth/change-password"""

    async def test_change_password_success(self, client: AsyncClient, student: User):
        resp = await client.put("/api/auth/change-password", json={
            "old_password": "Student@123",
            "new_password": "NewPass@456",
        }, headers=student_headers(student))
        assert resp.status_code == 200
        assert resp.json()["detail"] == "Password changed successfully"

        # Verify new password works
        resp2 = await client.post("/api/auth/login", json={
            "login_id": "student@test.com",
            "password": "NewPass@456",
        })
        assert resp2.status_code == 200

    async def test_change_password_wrong_old(self, client: AsyncClient, student: User):
        resp = await client.put("/api/auth/change-password", json={
            "old_password": "WrongOld@123",
            "new_password": "NewPass@456",
        }, headers=student_headers(student))
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Incorrect old password"

    async def test_change_password_no_auth(self, client: AsyncClient):
        resp = await client.put("/api/auth/change-password", json={
            "old_password": "x",
            "new_password": "y",
        })
        assert resp.status_code in (401, 403)

    async def test_change_password_missing_fields(self, client: AsyncClient, student: User):
        resp = await client.put("/api/auth/change-password", json={},
                                headers=student_headers(student))
        assert resp.status_code == 422
