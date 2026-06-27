import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


async def _seed_logs(db: AsyncSession, tutor: User) -> None:
    """Insert a handful of log rows directly so list endpoint has data."""
    now = datetime.now(timezone.utc)
    rows = [
        ActivityLog(
            id=uuid.uuid4(), started_at=now, ended_at=now, duration_ms=10,
            actor_id=tutor.id, actor_name=tutor.name, actor_type="tutor",
            action="create_student_endpoint", method="POST", path="/api/students",
            target_type="students", status_code=201, outcome="success",
        ),
        ActivityLog(
            id=uuid.uuid4(), started_at=now, ended_at=now, duration_ms=5,
            actor_id=None, actor_name="ghost@test.com", actor_type=None,
            action="login_failed", method="POST", path="/api/auth/login",
            status_code=401, outcome="client_error",
        ),
        ActivityLog(
            id=uuid.uuid4(), started_at=now, ended_at=now, duration_ms=50,
            actor_id=tutor.id, actor_name=tutor.name, actor_type="tutor",
            action="delete_student_endpoint", method="DELETE", path="/api/students/x",
            target_type="students", status_code=500, outcome="server_error",
        ),
    ]
    for r in rows:
        db.add(r)
    await db.commit()


@pytest.mark.asyncio
class TestActivityLogApi:
    async def test_tutor_can_list(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get("/api/activity-logs", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3
        assert isinstance(data["items"], list)
        # Every item has the derived action_label
        for item in data["items"]:
            assert "action_label" in item
            assert isinstance(item["action_label"], str) and item["action_label"]

    async def test_student_forbidden(self, client: AsyncClient, tutor: User, student: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get("/api/activity-logs", headers=student_headers(student))
        assert resp.status_code == 403

    async def test_no_auth_rejected(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get("/api/activity-logs")
        assert resp.status_code in (401, 403)

    async def test_filter_by_outcome(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get(
            "/api/activity-logs?outcome=server_error", headers=tutor_headers(tutor)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(item["outcome"] == "server_error" for item in data["items"])

    async def test_filter_by_actor_type(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get(
            "/api/activity-logs?actor_type=tutor", headers=tutor_headers(tutor)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(item["actor_type"] == "tutor" for item in data["items"])

    async def test_search(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get(
            "/api/activity-logs?search=delete", headers=tutor_headers(tutor)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all("delete" in item["action"].lower() or "delete" in item["path"].lower()
                   for item in data["items"])

    async def test_actions_endpoint(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.get("/api/activity-logs/actions", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        values = {item["value"] for item in data}
        # Seeded actions are present
        assert "create_student_endpoint" in values
        assert "login_failed" in values
        # Every entry has a human label
        for item in data:
            assert item["label"]

    async def test_no_write_api(self, client: AsyncClient, tutor: User):
        """Confirm the root collection has no unintended write methods."""
        for method in ("put", "patch", "delete"):
            m = getattr(client, method)
            resp = await m("/api/activity-logs", headers=tutor_headers(tutor))
            assert resp.status_code == 405, (
                f"{method.upper()} /api/activity-logs should return 405, got {resp.status_code}"
            )


@pytest.mark.asyncio
class TestBulkDelete:
    async def test_delete_by_date_range(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.post(
            "/api/activity-logs/bulk-delete",
            json={"start_date": "2000-01-01T00:00:00Z", "end_date": "2100-01-01T00:00:00Z"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted"] >= 3

    async def test_delete_by_outcome(self, client: AsyncClient, tutor: User, db: AsyncSession):
        await _seed_logs(db, tutor)
        resp = await client.post(
            "/api/activity-logs/bulk-delete",
            json={"outcomes": ["success"]},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted"] >= 1
        # Verify success rows are gone
        list_resp = await client.get(
            "/api/activity-logs?outcome=success", headers=tutor_headers(tutor)
        )
        assert list_resp.json()["total"] == 0

    async def test_empty_body_rejected(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            "/api/activity-logs/bulk-delete",
            json={},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422

    async def test_student_forbidden(self, client: AsyncClient, student: User):
        resp = await client.post(
            "/api/activity-logs/bulk-delete",
            json={"outcomes": ["success"]},
            headers=student_headers(student),
        )
        assert resp.status_code == 403
