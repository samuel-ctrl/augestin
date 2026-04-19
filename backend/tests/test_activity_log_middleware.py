import asyncio
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog  # noqa: F401 — ensure mapper registration
from app.models.user import User
from app.services.activity_log import sanitize_body, prepare_body_for_log
from tests.conftest import tutor_headers


async def _wait_for_logs(db: AsyncSession, min_count: int = 1, timeout: float = 2.0):
    """Wait for background log-insert tasks to land in DB."""
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
class TestStateChangingRequestsLogged:
    async def test_post_creates_log_row(self, client: AsyncClient, tutor: User, db: AsyncSession):
        resp = await client.post(
            "/api/students", json={"name": "Test Kid"}, headers=tutor_headers(tutor)
        )
        assert resp.status_code == 201
        rows = await _wait_for_logs(db, min_count=1)
        creation_logs = [r for r in rows if r.action == "create_student_endpoint"]
        assert len(creation_logs) == 1
        row = creation_logs[0]
        assert row.outcome == "success"
        assert row.method == "POST"
        assert row.actor_id == tutor.id
        assert row.actor_type == "tutor"
        assert row.duration_ms is not None and row.duration_ms >= 0
        assert row.started_at <= row.ended_at

    async def test_get_request_is_not_logged(self, client: AsyncClient, tutor: User, db: AsyncSession):
        resp = await client.get("/api/students", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        await asyncio.sleep(0.2)
        result = await db.execute(select(ActivityLog))
        rows = list(result.scalars())
        # Reads never produce log rows
        assert all(r.method != "GET" for r in rows)

    async def test_validation_error_logged_as_client_error(self, client: AsyncClient, tutor: User, db: AsyncSession):
        resp = await client.post(
            "/api/students", json={}, headers=tutor_headers(tutor)
        )
        assert resp.status_code == 422
        rows = await _wait_for_logs(db, min_count=1)
        validation_logs = [r for r in rows if r.status_code == 422]
        assert len(validation_logs) == 1
        assert validation_logs[0].outcome == "client_error"

    async def test_body_sensitive_fields_redacted(self, client: AsyncClient, student: User, db: AsyncSession):
        from tests.conftest import student_headers
        resp = await client.put(
            "/api/auth/change-password",
            json={"old_password": "Student@123", "new_password": "NewPass@456"},
            headers=student_headers(student),
        )
        # Login endpoint is handled explicitly; change-password goes through middleware
        assert resp.status_code == 200
        rows = await _wait_for_logs(db, min_count=1)
        chg = [r for r in rows if r.action == "change_pwd"]
        assert len(chg) == 1
        body = chg[0].meta["request_body"]
        assert body["old_password"] == "<redacted>"
        assert body["new_password"] == "<redacted>"


@pytest.mark.asyncio
class TestSanitizeBodyHelper:
    def test_redacts_password(self):
        result = sanitize_body({"name": "Ada", "password": "secret"})
        assert result == {"name": "Ada", "password": "<redacted>"}

    def test_redacts_case_insensitive(self):
        result = sanitize_body({"Password": "x", "Token": "y"})
        assert result == {"Password": "<redacted>", "Token": "<redacted>"}

    def test_redacts_nested(self):
        result = sanitize_body({"user": {"password": "secret"}, "list": [{"token": "t"}]})
        assert result == {"user": {"password": "<redacted>"}, "list": [{"token": "<redacted>"}]}

    def test_preserves_non_sensitive(self):
        result = sanitize_body({"email": "e@x.com", "name": "Ada"})
        assert result == {"email": "e@x.com", "name": "Ada"}


@pytest.mark.asyncio
class TestPrepareBodyForLog:
    def test_returns_none_for_empty(self):
        assert prepare_body_for_log(b"", "application/json") is None

    def test_returns_none_for_non_json(self):
        assert prepare_body_for_log(b"some text", "text/plain") is None

    def test_parses_json_and_sanitizes(self):
        result = prepare_body_for_log(b'{"name":"Ada","password":"x"}', "application/json")
        assert result == {"name": "Ada", "password": "<redacted>"}

    def test_truncates_oversized_body(self):
        big = b'{"x":"' + b"a" * 5000 + b'"}'
        result = prepare_body_for_log(big, "application/json")
        assert isinstance(result, dict)
        assert result.get("_truncated") is True
        assert result["size_bytes"] == len(big)

    def test_returns_none_on_malformed_json(self):
        assert prepare_body_for_log(b"{not json", "application/json") is None
