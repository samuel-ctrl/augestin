import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quiz_set import QuizSet
from app.models.quiz_set_assignment import QuizSetAssignment
from app.models.question import Question
from app.models.user import User
from tests.conftest import student_headers, tutor_headers


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def quiz_set(db: AsyncSession, tutor: User) -> QuizSet:
    qs = QuizSet(
        id=uuid.uuid4(),
        tutor_id=tutor.id,
        name="Test Quiz Set",
        description="A test quiz set",
    )
    db.add(qs)
    await db.commit()
    await db.refresh(qs)
    return qs


@pytest.fixture
async def quiz_set_with_questions(db: AsyncSession, quiz_set: QuizSet) -> QuizSet:
    for i in range(3):
        q = Question(
            id=uuid.uuid4(),
            quiz_set_id=quiz_set.id,
            question_text=f"Question {i+1}?",
            option_a="A answer",
            option_b="B answer",
            option_c="C answer",
            option_d="D answer",
            correct_option="A",
            explanation=f"Explanation {i+1}",
            time_limit_seconds=30,
        )
        db.add(q)
    await db.commit()
    await db.refresh(quiz_set)
    return quiz_set


@pytest.fixture
async def quiz_set_assignment(
    db: AsyncSession, quiz_set: QuizSet, student: User
) -> QuizSetAssignment:
    a = QuizSetAssignment(
        id=uuid.uuid4(),
        quiz_set_id=quiz_set.id,
        student_id=student.id,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


QUESTION_PAYLOAD = {
    "question_text": "What is 2+2?",
    "option_a": "3",
    "option_b": "4",
    "option_c": "5",
    "option_d": "6",
    "correct_option": "B",
    "explanation": "Basic addition",
    "time_limit_seconds": 60,
}


# ============================================================================
# QUIZ SET CRUD
# ============================================================================


@pytest.mark.asyncio
class TestCreateQuizSet:
    """POST /api/quiz-sets"""

    async def test_create_success(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            "/api/quiz-sets",
            json={"name": "My Quiz", "description": "desc"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Quiz"
        assert data["description"] == "desc"
        assert data["created_by"] == str(tutor.id)
        assert data["question_count"] == 0

    async def test_create_minimal(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            "/api/quiz-sets",
            json={"name": "Minimal"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Minimal"

    async def test_create_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/quiz-sets", json={"name": "No auth"})
        assert resp.status_code == 401

    async def test_create_student_forbidden(self, client: AsyncClient, student: User):
        resp = await client.post(
            "/api/quiz-sets",
            json={"name": "Student attempt"},
            headers=student_headers(student),
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestListQuizSets:
    """GET /api/quiz-sets"""

    async def test_list_empty(self, client: AsyncClient, tutor: User):
        resp = await client.get("/api/quiz-sets", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_with_data(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.get("/api/quiz-sets", headers=tutor_headers(tutor))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["id"] == str(quiz_set.id)

    async def test_list_search(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.get(
            "/api/quiz-sets?search=Test",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        resp = await client.get(
            "/api/quiz-sets?search=nonexistent",
            headers=tutor_headers(tutor),
        )
        assert resp.json()["total"] == 0

    async def test_list_pagination(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.get(
            "/api/quiz-sets?page=1&page_size=1",
            headers=tutor_headers(tutor),
        )
        data = resp.json()
        assert data["page"] == 1
        assert data["page_size"] == 1

    async def test_list_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/quiz-sets")
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestGetQuizSet:
    """GET /api/quiz-sets/{id}"""

    async def test_get_success(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set.id}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(quiz_set.id)
        assert data["name"] == quiz_set.name

    async def test_get_with_question_count(
        self, client: AsyncClient, tutor: User, quiz_set_with_questions: QuizSet
    ):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["question_count"] == 3

    async def test_get_not_found(self, client: AsyncClient, tutor: User):
        resp = await client.get(
            f"/api/quiz-sets/{uuid.uuid4()}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestUpdateQuizSet:
    """PUT /api/quiz-sets/{id}"""

    async def test_update_name(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.put(
            f"/api/quiz-sets/{quiz_set.id}",
            json={"name": "Updated Name"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    async def test_update_description(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.put(
            f"/api/quiz-sets/{quiz_set.id}",
            json={"description": "New description"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "New description"

    async def test_update_not_found(self, client: AsyncClient, tutor: User):
        resp = await client.put(
            f"/api/quiz-sets/{uuid.uuid4()}",
            json={"name": "x"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_update_other_tutor_forbidden(
        self, client: AsyncClient, db: AsyncSession, quiz_set: QuizSet
    ):
        """A different tutor cannot update another's quiz set."""
        from app.utils.password import hash_password

        other_tutor = User(
            id=uuid.uuid4(),
            login_id="other_tutor@test.com",
            name="Other Tutor",
            email="other_tutor@test.com",
            password_hash=hash_password("Other@123"),
            user_type="tutor",
            must_change_password=False,
        )
        db.add(other_tutor)
        await db.commit()

        resp = await client.put(
            f"/api/quiz-sets/{quiz_set.id}",
            json={"name": "Hijack"},
            headers=tutor_headers(other_tutor),
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestDeleteQuizSet:
    """DELETE /api/quiz-sets/{id}"""

    async def test_delete_success(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.delete(
            f"/api/quiz-sets/{quiz_set.id}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set.id}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_delete_not_found(self, client: AsyncClient, tutor: User):
        resp = await client.delete(
            f"/api/quiz-sets/{uuid.uuid4()}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_delete_other_tutor_forbidden(
        self, client: AsyncClient, db: AsyncSession, quiz_set: QuizSet
    ):
        from app.utils.password import hash_password

        other_tutor = User(
            id=uuid.uuid4(),
            login_id="other_tutor2@test.com",
            name="Other Tutor 2",
            email="other_tutor2@test.com",
            password_hash=hash_password("Other@123"),
            user_type="tutor",
            must_change_password=False,
        )
        db.add(other_tutor)
        await db.commit()

        resp = await client.delete(
            f"/api/quiz-sets/{quiz_set.id}",
            headers=tutor_headers(other_tutor),
        )
        assert resp.status_code == 403


# ============================================================================
# QUESTIONS SUB-RESOURCE
# ============================================================================


@pytest.mark.asyncio
class TestListQuizSetQuestions:
    """GET /api/quiz-sets/{id}/questions"""

    async def test_list_empty(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    async def test_list_with_questions(
        self, client: AsyncClient, tutor: User, quiz_set_with_questions: QuizSet
    ):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/questions",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    async def test_list_search(
        self, client: AsyncClient, tutor: User, quiz_set_with_questions: QuizSet
    ):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/questions?search=Question 1",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


@pytest.mark.asyncio
class TestCreateQuizSetQuestion:
    """POST /api/quiz-sets/{id}/questions"""

    async def test_create_success(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            json=QUESTION_PAYLOAD,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["question_text"] == "What is 2+2?"
        assert data["correct_option"] == "B"
        assert data["quiz_set_id"] == str(quiz_set.id)
        assert data["book_id"] is None

    async def test_create_ignores_sort_order(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        """The frontend may send sort_order — it should be ignored, not cause an error."""
        payload = {**QUESTION_PAYLOAD, "sort_order": 0}
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            json=payload,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201

    async def test_create_validates_correct_option(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        payload = {**QUESTION_PAYLOAD, "correct_option": "Z"}
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            json=payload,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422

    async def test_create_missing_required_field(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            json={"question_text": "Incomplete"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422

    async def test_create_quiz_set_not_found(self, client: AsyncClient, tutor: User):
        resp = await client.post(
            f"/api/quiz-sets/{uuid.uuid4()}/questions",
            json=QUESTION_PAYLOAD,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400

    async def test_create_student_forbidden(
        self, client: AsyncClient, student: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            json=QUESTION_PAYLOAD,
            headers=student_headers(student),
        )
        assert resp.status_code == 403

    async def test_create_lowercase_option_normalized(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        payload = {**QUESTION_PAYLOAD, "correct_option": "b"}
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions",
            json=payload,
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        assert resp.json()["correct_option"] == "B"


@pytest.mark.asyncio
class TestBulkCreateQuizSetQuestions:
    """POST /api/quiz-sets/{id}/questions/bulk"""

    async def test_bulk_create_success(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions/bulk",
            json={"questions": [QUESTION_PAYLOAD, QUESTION_PAYLOAD]},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 2

    async def test_bulk_create_empty_list(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions/bulk",
            json={"questions": []},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        assert resp.json() == []

    async def test_bulk_create_invalid_question(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/questions/bulk",
            json={"questions": [{"question_text": "Incomplete"}]},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestReorderQuizSetQuestions:
    """PUT /api/quiz-sets/{id}/questions/reorder"""

    async def test_reorder_success(
        self, client: AsyncClient, tutor: User, quiz_set_with_questions: QuizSet
    ):
        # Get question IDs
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/questions",
            headers=tutor_headers(tutor),
        )
        ids = [item["id"] for item in resp.json()["items"]]

        resp = await client.put(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/questions/reorder",
            json={"question_ids": list(reversed(ids))},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200

    async def test_reorder_invalid_question_id(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.put(
            f"/api/quiz-sets/{quiz_set.id}/questions/reorder",
            json={"question_ids": [str(uuid.uuid4())]},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400


# ============================================================================
# ASSIGNMENTS
# ============================================================================


@pytest.mark.asyncio
class TestAssignStudent:
    """POST /api/quiz-sets/{id}/assignments"""

    async def test_assign_success(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet, student: User
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/assignments",
            json={"student_id": str(student.id)},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["student_id"] == str(student.id)
        assert data["quiz_set_id"] == str(quiz_set.id)
        assert data["student_name"] == student.name

    async def test_assign_duplicate(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet, student: User,
        quiz_set_assignment: QuizSetAssignment,
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/assignments",
            json={"student_id": str(student.id)},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 409

    async def test_assign_quiz_set_not_found(self, client: AsyncClient, tutor: User, student: User):
        resp = await client.post(
            f"/api/quiz-sets/{uuid.uuid4()}/assignments",
            json={"student_id": str(student.id)},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_assign_student_not_found(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/assignments",
            json={"student_id": str(uuid.uuid4())},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404

    async def test_assign_invalid_student_id(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set.id}/assignments",
            json={"student_id": "not-a-uuid"},
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
class TestListAssignments:
    """GET /api/quiz-sets/{id}/assignments"""

    async def test_list_empty(self, client: AsyncClient, tutor: User, quiz_set: QuizSet):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set.id}/assignments",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_list_with_assignment(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet,
        quiz_set_assignment: QuizSetAssignment, student: User,
    ):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set.id}/assignments",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["student_id"] == str(student.id)

    async def test_list_quiz_set_not_found(self, client: AsyncClient, tutor: User):
        resp = await client.get(
            f"/api/quiz-sets/{uuid.uuid4()}/assignments",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestUnassignStudent:
    """DELETE /api/quiz-sets/{id}/assignments/{student_id}"""

    async def test_unassign_success(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet,
        student: User, quiz_set_assignment: QuizSetAssignment,
    ):
        resp = await client.delete(
            f"/api/quiz-sets/{quiz_set.id}/assignments/{student.id}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 204

    async def test_unassign_not_found(
        self, client: AsyncClient, tutor: User, quiz_set: QuizSet
    ):
        resp = await client.delete(
            f"/api/quiz-sets/{quiz_set.id}/assignments/{uuid.uuid4()}",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 404


# ============================================================================
# STUDENT QUIZ FLOW
# ============================================================================


@pytest.mark.asyncio
class TestStudentQuizFlow:
    """Full student quiz lifecycle for quiz sets."""

    async def test_get_session(
        self, client: AsyncClient, student: User,
        quiz_set_with_questions: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_questions"] == 3

    async def test_start_quiz(
        self, client: AsyncClient, student: User,
        quiz_set_with_questions: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/start",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_started"] is True
        assert data["is_completed"] is False

    async def test_submit_answer(
        self, client: AsyncClient, student: User,
        quiz_set_with_questions: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        # Start quiz first
        await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/start",
            headers=student_headers(student),
        )

        # Get questions
        session = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz",
            headers=student_headers(student),
        )
        questions = session.json()["questions"]
        q_id = questions[0]["id"]

        # Submit answer
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/submit",
            json={
                "question_id": q_id,
                "selected_option": "A",
                "time_taken_seconds": 10,
            },
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_correct"] is True
        assert data["correct_option"] == "A"

    async def test_submit_skip(
        self, client: AsyncClient, student: User,
        quiz_set_with_questions: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/start",
            headers=student_headers(student),
        )

        session = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz",
            headers=student_headers(student),
        )
        q_id = session.json()["questions"][0]["id"]

        resp = await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/submit",
            json={"question_id": q_id, "is_skipped": True},
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        assert resp.json()["is_skipped"] is True

    async def test_complete_quiz(
        self, client: AsyncClient, student: User,
        quiz_set_with_questions: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        # Start
        await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/start",
            headers=student_headers(student),
        )

        # Complete
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/complete",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_completed"] is True

    async def test_get_progress(
        self, client: AsyncClient, student: User,
        quiz_set_with_questions: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        # Start quiz
        await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/start",
            headers=student_headers(student),
        )

        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/progress",
            headers=student_headers(student),
        )
        assert resp.status_code == 200

    async def test_quiz_not_assigned_rejected(
        self, client: AsyncClient, student: User, quiz_set_with_questions: QuizSet
    ):
        """Student cannot access quiz without assignment."""
        resp = await client.get(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz",
            headers=student_headers(student),
        )
        assert resp.status_code == 400
        assert "not assigned" in resp.json()["detail"].lower()

    async def test_tutor_cannot_take_quiz(
        self, client: AsyncClient, tutor: User, quiz_set_with_questions: QuizSet
    ):
        resp = await client.post(
            f"/api/quiz-sets/{quiz_set_with_questions.id}/quiz/start",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 403


# ============================================================================
# STUDENT LISTING
# ============================================================================


@pytest.mark.asyncio
class TestStudentListQuizSets:
    """GET /api/students/quiz-sets"""

    async def test_list_empty(self, client: AsyncClient, student: User):
        resp = await client.get(
            "/api/students/quiz-sets",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_with_assignment(
        self, client: AsyncClient, student: User,
        quiz_set: QuizSet, quiz_set_assignment: QuizSetAssignment,
    ):
        resp = await client.get(
            "/api/students/quiz-sets",
            headers=student_headers(student),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == str(quiz_set.id)
        assert data[0]["name"] == quiz_set.name

    async def test_tutor_forbidden(self, client: AsyncClient, tutor: User):
        resp = await client.get(
            "/api/students/quiz-sets",
            headers=tutor_headers(tutor),
        )
        assert resp.status_code == 403
