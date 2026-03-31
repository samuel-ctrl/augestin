import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_recap import BookRecap
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def recap(db: AsyncSession, book: Book, tutor: User) -> BookRecap:
    r = BookRecap(
        id=uuid.uuid4(),
        book_id=book.id,
        author_id=tutor.id,
        title="Test Recap",
        content={"type": "document", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello"}]}]},
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


RECAP_PAYLOAD = {
    "title": "My Recap",
    "content": {
        "type": "document",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Notes here"}]},
        ],
    },
}


# ============================================================================
# GET RECAP
# ============================================================================


@pytest.mark.asyncio
class TestGetRecap:
    """GET /api/books/{book_id}/recap"""

    async def test_get_existing(self, client: AsyncClient, tutor: User, book: Book, recap: BookRecap):
        resp = await client.get(
            f"/api/books/{book.id}/recap",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(recap.id)
        assert data["title"] == "Test Recap"
        assert data["book_id"] == str(book.id)
        assert data["created_by"] == str(tutor.id)

    async def test_get_none(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.get(
            f"/api/books/{book.id}/recap",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json() is None

    async def test_student_can_read(self, client: AsyncClient, student: User, book: Book, recap: BookRecap):
        resp = await client.get(
            f"/api/books/{book.id}/recap",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == str(recap.id)

    async def test_unauthenticated(self, client: AsyncClient, book: Book):
        resp = await client.get(f"/api/books/{book.id}/recap")
        assert resp.status_code == 401


# ============================================================================
# CREATE / UPDATE RECAP (POST)
# ============================================================================


@pytest.mark.asyncio
class TestCreateRecap:
    """POST /api/books/{book_id}/recap"""

    async def test_create_success(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.post(
            f"/api/books/{book.id}/recap",
            json=RECAP_PAYLOAD,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My Recap"
        assert data["book_id"] == str(book.id)
        assert data["created_by"] == str(tutor.id)
        assert data["content"]["type"] == "document"

    async def test_create_upserts(self, client: AsyncClient, tutor: User, book: Book, recap: BookRecap):
        """POST on a book that already has a recap should update it."""
        resp = await client.post(
            f"/api/books/{book.id}/recap",
            json={"title": "Updated", "content": {"type": "document", "content": []}},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "Updated"
        # ID should remain the same (upsert, not duplicate)
        assert resp.json()["id"] == str(recap.id)

    async def test_create_invalid_book(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            f"/api/books/{uuid.uuid4()}/recap",
            json=RECAP_PAYLOAD,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400
        assert "not found" in resp.json()["detail"].lower()

    async def test_create_student_forbidden(self, client: AsyncClient, student: User, book: Book):
        resp = await client.post(
            f"/api/books/{book.id}/recap",
            json=RECAP_PAYLOAD,
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_create_unauthenticated(self, client: AsyncClient, book: Book):
        resp = await client.post(
            f"/api/books/{book.id}/recap",
            json=RECAP_PAYLOAD,
        )
        assert resp.status_code == 401

    async def test_unsupported_node_types_stripped(self, client: AsyncClient, tutor: User, book: Book):
        """Unsupported Tiptap extensions should be removed silently."""
        payload = {
            "title": "With Table",
            "content": {
                "type": "document",
                "content": [
                    {"type": "table", "content": []},
                    {"type": "paragraph", "content": [{"type": "text", "text": "kept"}]},
                ],
            },
        }
        resp = await client.post(
            f"/api/books/{book.id}/recap",
            json=payload,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        content = resp.json()["content"]
        node_types = [n["type"] for n in content.get("content", [])]
        assert "table" not in node_types
        assert "paragraph" in node_types


# ============================================================================
# UPDATE RECAP (PUT)
# ============================================================================


@pytest.mark.asyncio
class TestUpdateRecap:
    """PUT /api/books/{book_id}/recap"""

    async def test_update_title(self, client: AsyncClient, tutor: User, book: Book, recap: BookRecap):
        resp = await client.put(
            f"/api/books/{book.id}/recap",
            json={"title": "New Title"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New Title"

    async def test_update_content(self, client: AsyncClient, tutor: User, book: Book, recap: BookRecap):
        new_content = {"type": "document", "content": [{"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Updated"}]}]}
        resp = await client.put(
            f"/api/books/{book.id}/recap",
            json={"content": new_content},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200

    async def test_update_not_found(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.put(
            f"/api/books/{book.id}/recap",
            json={"title": "No recap"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_update_other_tutor_forbidden(
        self, client: AsyncClient, db: AsyncSession, book: Book, recap: BookRecap
    ):
        from app.utils.password import hash_password

        other_tutor = User(
            id=uuid.uuid4(),
            login_id="other_recap_tutor@test.com",
            name="Other Tutor",
            email="other_recap_tutor@test.com",
            password_hash=hash_password("Other@123"),
            user_type="tutor",
            must_change_password=False,
        )
        db.add(other_tutor)
        await db.commit()

        resp = await client.put(
            f"/api/books/{book.id}/recap",
            json={"title": "Hijack"},
            headers=tutor_headers(other_tutor),
        )
        assert resp.status_code == 403

    async def test_update_student_forbidden(self, client: AsyncClient, student: User, book: Book, recap: BookRecap):
        resp = await client.put(
            f"/api/books/{book.id}/recap",
            json={"title": "Nope"},
            headers=student_headers(student),
        )
        assert resp.status_code == 403


# ============================================================================
# DELETE RECAP
# ============================================================================


@pytest.mark.asyncio
class TestDeleteRecap:
    """DELETE /api/books/{book_id}/recap"""

    async def test_delete_success(self, client: AsyncClient, tutor: User, book: Book, recap: BookRecap):
        resp = await client.delete(
            f"/api/books/{book.id}/recap",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get(
            f"/api/books/{book.id}/recap",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json() is None

    async def test_delete_not_found(self, client: AsyncClient, tutor: User, book: Book):
        resp = await client.delete(
            f"/api/books/{book.id}/recap",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_delete_other_tutor_forbidden(
        self, client: AsyncClient, db: AsyncSession, book: Book, recap: BookRecap
    ):
        from app.utils.password import hash_password

        other_tutor = User(
            id=uuid.uuid4(),
            login_id="other_del_tutor@test.com",
            name="Other Tutor",
            email="other_del_tutor@test.com",
            password_hash=hash_password("Other@123"),
            user_type="tutor",
            must_change_password=False,
        )
        db.add(other_tutor)
        await db.commit()

        resp = await client.delete(
            f"/api/books/{book.id}/recap",
            headers=tutor_headers(other_tutor),
        )
        assert resp.status_code == 403

    async def test_delete_student_forbidden(self, client: AsyncClient, student: User, book: Book, recap: BookRecap):
        resp = await client.delete(
            f"/api/books/{book.id}/recap",
            headers=student_headers(student),
        )
        assert resp.status_code == 403
