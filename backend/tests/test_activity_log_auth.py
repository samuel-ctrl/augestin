import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.user import User


async def _wait_for_logs(db: AsyncSession, min_count: int = 1, timeout: float = 2.0):
    deadline = timeout
    step = 0.05
    while deadline > 0:
        await asyncio.sleep(step)
        deadline -= step
        result = await db.execute(select(ActivityLog))
        rows = list(result.scalars())
        if len(rows) >= min_count:
            return rows
    return rows


@pytest.mark.asyncio
class TestLoginLogging:
    async def test_successful_login_logged(self, client: AsyncClient, tutor: User, db: AsyncSession):
        resp = await client.post("/api/auth/login", json={
            "login_id": "tutor@test.com",
            "password": "Tutor@123",
        })
        assert resp.status_code == 200
        rows = await _wait_for_logs(db, min_count=1)
        login_rows = [r for r in rows if r.action == "login"]
        assert len(login_rows) == 1
        row = login_rows[0]
        assert row.outcome == "success"
        assert row.actor_id == tutor.id
        assert row.actor_name == "Test Tutor"
        assert row.actor_type == "tutor"
        assert row.status_code == 200

    async def test_failed_login_logged(self, client: AsyncClient, tutor: User, db: AsyncSession):
        resp = await client.post("/api/auth/login", json={
            "login_id": "tutor@test.com",
            "password": "WrongPass",
        })
        assert resp.status_code == 401
        rows = await _wait_for_logs(db, min_count=1)
        failed_rows = [r for r in rows if r.action == "login_failed"]
        assert len(failed_rows) == 1
        row = failed_rows[0]
        assert row.outcome == "client_error"
        assert row.actor_id is None
        assert row.actor_name == "tutor@test.com"  # submitted login_id, captured for forensics
        assert row.actor_type is None
        assert row.status_code == 401

    async def test_login_body_is_not_captured_from_endpoint(self, client: AsyncClient, tutor: User, db: AsyncSession):
        """The /api/auth/login path is skipped by middleware so the password
        in the request body never reaches meta.request_body."""
        await client.post("/api/auth/login", json={
            "login_id": "tutor@test.com",
            "password": "Tutor@123",
        })
        rows = await _wait_for_logs(db, min_count=1)
        login_rows = [r for r in rows if r.action == "login"]
        row = login_rows[0]
        # Explicit log_activity call in the endpoint does not set meta
        assert row.meta is None or "request_body" not in (row.meta or {})
