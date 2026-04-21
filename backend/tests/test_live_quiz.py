"""Tests for the multiplayer live-quiz feature.

Covers room lifecycle, scoring, privacy (correct_option stripping), idempotent
rejoin, host-only actions, and disconnect debounce. State is in-memory so we
clear the rooms registry between tests.
"""
import asyncio
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.quiz_set import QuizSet
from app.models.quiz_set_assignment import QuizSetAssignment
from app.models.user import User, UserType
from app.services import live_quiz
from app.utils.password import hash_password
from tests.conftest import auth_header, student_headers, tutor_headers
from app.utils.jwt import create_token


@pytest.fixture(autouse=True)
def _reset_rooms():
    live_quiz._rooms.clear()
    for task in list(live_quiz._disconnect_tasks.values()):
        task.cancel()
    live_quiz._disconnect_tasks.clear()
    yield
    live_quiz._rooms.clear()
    for task in list(live_quiz._disconnect_tasks.values()):
        task.cancel()
    live_quiz._disconnect_tasks.clear()


@pytest.fixture
async def quiz_set(db: AsyncSession, tutor: User) -> QuizSet:
    qs = QuizSet(id=uuid.uuid4(), tutor_id=tutor.id, name="Live QS", description=None)
    db.add(qs)
    await db.commit()
    await db.refresh(qs)
    return qs


@pytest.fixture
async def qs_with_questions(db: AsyncSession, quiz_set: QuizSet) -> QuizSet:
    for i, correct in enumerate(["A", "B", "C"]):
        db.add(Question(
            id=uuid.uuid4(),
            quiz_set_id=quiz_set.id,
            question_text=f"Q{i+1}?",
            option_a="A", option_b="B", option_c="C", option_d="D",
            correct_option=correct,
            time_limit_seconds=30,
        ))
    await db.commit()
    await db.refresh(quiz_set)
    return quiz_set


@pytest.fixture
async def assigned_quiz(
    db: AsyncSession, qs_with_questions: QuizSet, student: User
) -> QuizSet:
    db.add(QuizSetAssignment(
        id=uuid.uuid4(),
        quiz_set_id=qs_with_questions.id,
        student_id=student.id,
    ))
    await db.commit()
    return qs_with_questions


@pytest.fixture
async def second_student(db: AsyncSession, tutor: User) -> User:
    u = User(
        id=uuid.uuid4(),
        login_id="student2@test.com",
        name="Student Two",
        password_hash=hash_password("Pw@12345"),
        user_type=UserType.student,
        standard="5",
        must_change_password=False,
        created_by=str(tutor.id),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


def _student_headers_for(s: User) -> dict:
    return auth_header(create_token(str(s.id), "student"))


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def test_generate_code_alphabet_and_length():
    codes = {live_quiz._generate_code() for _ in range(200)}
    assert all(len(c) == live_quiz.CODE_LENGTH for c in codes)
    forbidden = set("IO01")
    assert not any(set(c) & forbidden for c in codes)


def test_strip_question_removes_correct_option():
    q = {"id": "x", "question_text": "?", "correct_option": "A", "explanation": "why"}
    stripped = live_quiz._strip_question(q)
    assert "correct_option" not in stripped
    assert "explanation" not in stripped
    assert stripped["question_text"] == "?"


# ---------------------------------------------------------------------------
# create + access
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_room_as_tutor_owner(client: AsyncClient, tutor: User, qs_with_questions: QuizSet):
    res = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(qs_with_questions.id)},
        headers=tutor_headers(tutor),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "lobby"
    assert body["host_type"] == "tutor"
    assert body["you_role"] == "host"
    assert len(body["code"]) == live_quiz.CODE_LENGTH
    # Lobby returns no questions yet
    assert body["questions"] == []


@pytest.mark.asyncio
async def test_create_room_blocks_unassigned_student(
    client: AsyncClient, second_student: User, qs_with_questions: QuizSet
):
    res = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(qs_with_questions.id)},
        headers=_student_headers_for(second_student),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_room_total_time_validated(
    client: AsyncClient, tutor: User, qs_with_questions: QuizSet
):
    res = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(qs_with_questions.id), "total_time_seconds": 5},
        headers=tutor_headers(tutor),
    )
    assert res.status_code == 422  # below ge=30


@pytest.mark.asyncio
async def test_create_room_with_no_questions_400(
    client: AsyncClient, tutor: User, quiz_set: QuizSet
):
    res = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(quiz_set.id)},
        headers=tutor_headers(tutor),
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# join + idempotency
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_student_joins_then_rejoin_is_idempotent(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]

    j1 = await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    assert j1.status_code == 200
    assert len(j1.json()["participants"]) == 2

    # Rejoin should return the same room without adding a duplicate
    j2 = await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    assert j2.status_code == 200
    assert len(j2.json()["participants"]) == 2


@pytest.mark.asyncio
async def test_join_after_start_blocked_for_new_user(
    client: AsyncClient, tutor: User, student: User, second_student: User,
    assigned_quiz: QuizSet, db: AsyncSession,
):
    db.add(QuizSetAssignment(
        id=uuid.uuid4(), quiz_set_id=assigned_quiz.id, student_id=second_student.id,
    ))
    await db.commit()

    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    await client.post(f"/api/quiz-rooms/{code}/start", headers=tutor_headers(tutor))

    # second_student tries to join after start
    late = await client.post(f"/api/quiz-rooms/{code}/join", headers=_student_headers_for(second_student))
    assert late.status_code == 409


# ---------------------------------------------------------------------------
# start race + authorization
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_room_only_by_host(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))

    bad = await client.post(f"/api/quiz-rooms/{code}/start", headers=student_headers(student))
    assert bad.status_code == 403


@pytest.mark.asyncio
async def test_concurrent_start_creates_one_timer(
    client: AsyncClient, tutor: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]

    r1, r2 = await asyncio.gather(
        client.post(f"/api/quiz-rooms/{code}/start", headers=tutor_headers(tutor)),
        client.post(f"/api/quiz-rooms/{code}/start", headers=tutor_headers(tutor)),
    )
    statuses = sorted([r1.status_code, r2.status_code])
    # Exactly one wins; the loser hits the in-lock recheck and gets 409.
    assert statuses == [200, 409], statuses
    room = live_quiz.get_room(code)
    assert room.status == "active"
    assert room.timer_task is not None and not room.timer_task.done()
    # Only one timer task — second start did not orphan one
    room.timer_task.cancel()


# ---------------------------------------------------------------------------
# answer + scoring + privacy
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_answer_scoring_correct_count_and_privacy(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    started = await client.post(f"/api/quiz-rooms/{code}/start", headers=tutor_headers(tutor))
    questions = started.json()["questions"]
    assert len(questions) == 3
    # Privacy guard: questions must not leak correct_option mid-game
    assert all("correct_option" not in q for q in questions)
    assert all("explanation" not in q for q in questions)

    # Answer Q1 correctly (correct_option is A), Q2 wrong, skip Q3
    q_ids = [q["id"] for q in questions]
    await client.post(
        f"/api/quiz-rooms/{code}/answer",
        json={"question_id": q_ids[0], "selected_option": "A"},
        headers=student_headers(student),
    )
    await client.post(
        f"/api/quiz-rooms/{code}/answer",
        json={"question_id": q_ids[1], "selected_option": "A"},  # actual is B
        headers=student_headers(student),
    )
    await client.post(
        f"/api/quiz-rooms/{code}/answer",
        json={"question_id": q_ids[2], "selected_option": None, "is_skipped": True},
        headers=student_headers(student),
    )

    # Player snapshot during play: still no correct answers visible
    snap = await client.get(f"/api/quiz-rooms/{code}", headers=student_headers(student))
    body = snap.json()
    assert all("correct_option" not in q for q in body["questions"])
    # Live leaderboard does NOT reveal correct_count
    me = next(e for e in body["leaderboard"] if e["user_id"] == str(student.id))
    assert me["correct_count"] is None
    assert me["score_percentage"] is None
    assert me["answered_count"] == 2  # skip not counted as "answered"

    # Finish: scores reveal, answers reveal
    fin = await client.post(f"/api/quiz-rooms/{code}/complete", headers=student_headers(student))
    fbody = fin.json()
    assert fbody["status"] == "finished"  # only player, so all done -> finalize
    me_final = next(e for e in fbody["leaderboard"] if e["user_id"] == str(student.id))
    # 1 correct out of 3 questions -> 33.3
    assert me_final["correct_count"] == 1
    assert me_final["total_questions"] == 3
    assert any("correct_option" in q for q in fbody["questions"])


@pytest.mark.asyncio
async def test_host_cannot_answer(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    started = await client.post(f"/api/quiz-rooms/{code}/start", headers=tutor_headers(tutor))
    qid = started.json()["questions"][0]["id"]

    res = await client.post(
        f"/api/quiz-rooms/{code}/answer",
        json={"question_id": qid, "selected_option": "A"},
        headers=tutor_headers(tutor),
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# leave + kick + end
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_student_leaves_room(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))

    res = await client.post(f"/api/quiz-rooms/{code}/leave", headers=student_headers(student))
    assert res.status_code == 204

    snap = await client.get(f"/api/quiz-rooms/{code}", headers=tutor_headers(tutor))
    assert all(p["user_id"] != str(student.id) for p in snap.json()["participants"])


@pytest.mark.asyncio
async def test_host_cannot_leave_must_end(
    client: AsyncClient, tutor: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]

    res = await client.post(f"/api/quiz-rooms/{code}/leave", headers=tutor_headers(tutor))
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_host_kicks_participant(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))

    res = await client.post(
        f"/api/quiz-rooms/{code}/kick/{student.id}",
        headers=tutor_headers(tutor),
    )
    assert res.status_code == 204

    snap = await client.get(f"/api/quiz-rooms/{code}", headers=tutor_headers(tutor))
    assert all(p["user_id"] != str(student.id) for p in snap.json()["participants"])


@pytest.mark.asyncio
async def test_non_host_cannot_kick(
    client: AsyncClient, tutor: User, student: User, second_student: User,
    assigned_quiz: QuizSet, db: AsyncSession,
):
    db.add(QuizSetAssignment(
        id=uuid.uuid4(), quiz_set_id=assigned_quiz.id, student_id=second_student.id,
    ))
    await db.commit()
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    await client.post(f"/api/quiz-rooms/{code}/join", headers=_student_headers_for(second_student))

    res = await client.post(
        f"/api/quiz-rooms/{code}/kick/{second_student.id}",
        headers=student_headers(student),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_end_room_host_only(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))

    bad = await client.post(f"/api/quiz-rooms/{code}/end", headers=student_headers(student))
    assert bad.status_code == 403

    good = await client.post(f"/api/quiz-rooms/{code}/end", headers=tutor_headers(tutor))
    assert good.status_code == 200
    assert good.json()["status"] == "finished"


# ---------------------------------------------------------------------------
# list-my-rooms + no DB writes invariant
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_my_rooms_returns_active(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))

    res = await client.get("/api/quiz-rooms/mine", headers=student_headers(student))
    assert res.status_code == 200
    codes = [r["code"] for r in res.json()]
    assert code in codes


@pytest.mark.asyncio
async def test_finished_room_excluded_from_my_rooms(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet
):
    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    await client.post(f"/api/quiz-rooms/{code}/end", headers=tutor_headers(tutor))

    res = await client.get("/api/quiz-rooms/mine", headers=student_headers(student))
    assert all(r["code"] != code for r in res.json())


@pytest.mark.asyncio
async def test_no_db_writes_to_quiz_progress(
    client: AsyncClient, tutor: User, student: User, assigned_quiz: QuizSet, db: AsyncSession,
):
    """Ephemeral mode must not touch QuizProgress / QuizAttempt."""
    from app.models.quiz_progress import QuizProgress
    from app.models.quiz_attempt import QuizAttempt
    from sqlalchemy import select

    create = await client.post(
        "/api/quiz-rooms",
        json={"quiz_set_id": str(assigned_quiz.id)},
        headers=tutor_headers(tutor),
    )
    code = create.json()["code"]
    await client.post(f"/api/quiz-rooms/{code}/join", headers=student_headers(student))
    started = await client.post(f"/api/quiz-rooms/{code}/start", headers=tutor_headers(tutor))
    qid = started.json()["questions"][0]["id"]
    await client.post(
        f"/api/quiz-rooms/{code}/answer",
        json={"question_id": qid, "selected_option": "A"},
        headers=student_headers(student),
    )
    await client.post(f"/api/quiz-rooms/{code}/complete", headers=student_headers(student))

    progress_rows = (await db.execute(
        select(QuizProgress).where(QuizProgress.student_id == student.id)
    )).all()
    attempt_rows = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.student_id == student.id)
    )).all()
    assert progress_rows == []
    assert attempt_rows == []
