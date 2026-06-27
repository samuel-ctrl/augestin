"""In-memory live quiz rooms.

Ephemeral state — no DB persistence of results. Survives only for the lifetime
of the worker process. See plan: instead-why-not-we-tidy-tower.md
"""
import asyncio
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book_assignment import BookAssignment
from app.models.question import Question
from app.models.quiz_set import QuizSet
from app.models.quiz_set_assignment import QuizSetAssignment
from app.models.topic import Topic
from app.models.user import User, UserType
from app.websocket_manager import manager

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # excludes I, O, 0, 1
CODE_LENGTH = 6
MAX_CODE_RETRIES = 10
CLEANUP_DELAY_SECONDS = 600  # keep finished rooms 10 min so reconnects can fetch results
DISCONNECT_GRACE_SECONDS = 3  # smooth out brief network blips before flagging "left"
MIN_TIME_SECONDS = 30
MAX_TIME_SECONDS = 60 * 60  # 1 hour


RoleType = Literal["host", "player"]
StatusType = Literal["lobby", "active", "finished"]


@dataclass
class Participant:
    user_id: str
    name: str
    role: RoleType
    joined_at: datetime
    answers: dict[str, dict] = field(default_factory=dict)
    correct_count: int = 0
    answered_count: int = 0
    score_percentage: float = 0.0
    finished_at: Optional[datetime] = None
    connected: bool = True


@dataclass
class Room:
    # Required fields (no defaults) must come first
    code: str
    quiz_source: Literal["quiz_set", "topic"]
    host_id: str
    host_type: Literal["tutor", "student"]
    status: StatusType
    total_time_seconds: int
    questions: list[dict]
    # Optional fields
    quiz_set_id: Optional[str] = None
    quiz_set_name: Optional[str] = None
    topic_id: Optional[str] = None
    topic_title: Optional[str] = None
    started_at: Optional[datetime] = None
    timer_task: Optional[asyncio.Task] = None
    participants: dict[str, Participant] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


_rooms: dict[str, Room] = {}
_alloc_lock = asyncio.Lock()
# user_id -> pending disconnect task (for grace-period debounce)
_disconnect_tasks: dict[str, asyncio.Task] = {}


def _generate_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def _question_to_dict(q: Question) -> dict:
    return {
        "id": str(q.id),
        "question_text": q.question_text,
        "question_image_url": q.question_image_url,
        "option_a": q.option_a,
        "option_a_image_url": q.option_a_image_url,
        "option_b": q.option_b,
        "option_b_image_url": q.option_b_image_url,
        "option_c": q.option_c,
        "option_c_image_url": q.option_c_image_url,
        "option_d": q.option_d,
        "option_d_image_url": q.option_d_image_url,
        "correct_option": q.correct_option,
        "explanation": q.explanation,
        "time_limit_seconds": q.time_limit_seconds,
    }


def _strip_question(q: dict) -> dict:
    return {k: v for k, v in q.items() if k not in {"correct_option", "explanation"}}


def _participant_to_dict(p: Participant) -> dict:
    return {
        "user_id": p.user_id,
        "name": p.name,
        "role": p.role,
        "joined_at": p.joined_at.isoformat(),
        "connected": p.connected,
        "finished": p.finished_at is not None,
    }


def get_room(code: str) -> Room:
    room = _rooms.get(code.upper())
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def _can_access_topic_quiz(
    db: AsyncSession, user: User, topic_id: uuid.UUID
) -> tuple[bool, str]:
    """Return (can_access, reason). reason is 'ok' or 'not_assigned'."""
    if user.user_type == UserType.tutor:
        return False, "not_assigned"

    topic_res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = topic_res.scalar_one_or_none()
    if topic is None:
        return False, "not_assigned"

    assignment_res = await db.execute(
        select(BookAssignment).where(
            and_(
                BookAssignment.book_id == topic.book_id,
                BookAssignment.student_id == user.id,
            )
        )
    )
    if assignment_res.scalar_one_or_none() is None:
        return False, "not_assigned"

    return True, "ok"


async def _can_access_quiz_set(db: AsyncSession, user: User, quiz_set: QuizSet) -> bool:
    if user.user_type == UserType.tutor:
        return str(quiz_set.tutor_id) == str(user.id)
    res = await db.execute(
        select(QuizSetAssignment).where(
            and_(
                QuizSetAssignment.quiz_set_id == quiz_set.id,
                QuizSetAssignment.student_id == user.id,
            )
        )
    )
    return res.scalar_one_or_none() is not None


async def create_room(
    db: AsyncSession,
    user: User,
    quiz_set_id: uuid.UUID | None = None,
    topic_id: uuid.UUID | None = None,
    total_time_seconds: int | None = None,
) -> Room:
    if quiz_set_id is not None:
        res = await db.execute(select(QuizSet).where(QuizSet.id == quiz_set_id))
        quiz_set = res.scalar_one_or_none()
        if not quiz_set:
            raise HTTPException(status_code=404, detail="Quiz set not found")
        if not await _can_access_quiz_set(db, user, quiz_set):
            raise HTTPException(status_code=403, detail="You don't have access to this quiz set")

        qres = await db.execute(
            select(Question)
            .where(Question.quiz_set_id == quiz_set_id)
            .order_by(Question.created_at.asc())
        )
        questions = list(qres.scalars().all())
        if not questions:
            raise HTTPException(status_code=400, detail="Quiz set has no questions")

        quiz_source: Literal["quiz_set", "topic"] = "quiz_set"
        room_quiz_set_id: str | None = str(quiz_set_id)
        room_quiz_set_name: str | None = quiz_set.name
        room_topic_id: str | None = None
        room_topic_title: str | None = None

    else:
        assert topic_id is not None
        topic_res = await db.execute(select(Topic).where(Topic.id == topic_id))
        topic = topic_res.scalar_one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        can_access, reason = await _can_access_topic_quiz(db, user, topic_id)
        if not can_access:
            raise HTTPException(status_code=403, detail="Topic is not accessible to you")

        qres = await db.execute(
            select(Question)
            .where(Question.topic_id == topic_id)
            .order_by(Question.created_at.asc())
        )
        questions = list(qres.scalars().all())
        if not questions:
            raise HTTPException(status_code=400, detail="This topic has no quiz questions")

        quiz_source = "topic"
        room_quiz_set_id = None
        room_quiz_set_name = None
        room_topic_id = str(topic_id)
        room_topic_title = topic.title

    default_time = sum(q.time_limit_seconds for q in questions) or MIN_TIME_SECONDS
    if total_time_seconds is None:
        total_time = default_time
    else:
        if not (MIN_TIME_SECONDS <= total_time_seconds <= MAX_TIME_SECONDS):
            raise HTTPException(
                status_code=400,
                detail=f"total_time_seconds must be between {MIN_TIME_SECONDS} and {MAX_TIME_SECONDS}",
            )
        total_time = total_time_seconds

    host_type: Literal["tutor", "student"] = (
        "tutor" if user.user_type == UserType.tutor else "student"
    )
    role: RoleType = "host" if host_type == "tutor" else "player"

    # Atomic code allocation: hold _alloc_lock so two concurrent creates can't
    # pick the same code between the collision check and the assignment below.
    async with _alloc_lock:
        code: str | None = None
        for _ in range(MAX_CODE_RETRIES):
            candidate = _generate_code()
            if candidate not in _rooms:
                code = candidate
                break
        if code is None:
            raise HTTPException(status_code=503, detail="Could not allocate room code, retry")

        room = Room(
            code=code,
            quiz_source=quiz_source,
            host_id=str(user.id),
            host_type=host_type,
            status="lobby",
            total_time_seconds=total_time,
            questions=[_question_to_dict(q) for q in questions],
            quiz_set_id=room_quiz_set_id,
            quiz_set_name=room_quiz_set_name,
            topic_id=room_topic_id,
            topic_title=room_topic_title,
        )
        room.participants[str(user.id)] = Participant(
            user_id=str(user.id),
            name=user.name,
            role=role,
            joined_at=datetime.now(timezone.utc),
        )
        _rooms[code] = room

    manager.join_room(code, str(user.id))
    return room


async def join_room(db: AsyncSession, user: User, code: str) -> Room:
    room = get_room(code)
    if room.status == "finished":
        raise HTTPException(status_code=409, detail="Room is finished")

    user_id = str(user.id)
    # Cancel any pending disconnect debounce — the user is back.
    pending = _disconnect_tasks.pop(user_id, None)
    if pending and not pending.done():
        pending.cancel()

    is_new_join = False
    is_reconnect = False
    participant: Participant | None = None

    async with room.lock:
        if user_id in room.participants:
            existing = room.participants[user_id]
            was_connected = existing.connected
            existing.connected = True
            manager.join_room(room.code, user_id)
            participant = existing
            is_reconnect = not was_connected
        else:
            if room.status != "lobby":
                raise HTTPException(status_code=409, detail="Room already started")

            if room.quiz_source == "quiz_set":
                res = await db.execute(
                    select(QuizSet).where(QuizSet.id == uuid.UUID(room.quiz_set_id))
                )
                quiz_set = res.scalar_one_or_none()
                if not quiz_set or not await _can_access_quiz_set(db, user, quiz_set):
                    raise HTTPException(status_code=403, detail="You don't have access to this quiz set")
            else:
                can_access, reason = await _can_access_topic_quiz(db, user, uuid.UUID(room.topic_id))
                if not can_access:
                    raise HTTPException(status_code=403, detail=reason)

            host_type: Literal["tutor", "student"] = (
                "tutor" if user.user_type == UserType.tutor else "student"
            )
            role: RoleType = (
                "host" if host_type == "tutor" and user_id == room.host_id else "player"
            )
            participant = Participant(
                user_id=user_id,
                name=user.name,
                role=role,
                joined_at=datetime.now(timezone.utc),
            )
            room.participants[user_id] = participant
            manager.join_room(room.code, user_id)
            is_new_join = True

    if (is_new_join or is_reconnect) and participant is not None:
        await manager.send_to_room(room.code, {
            "type": "quiz-room:participant-joined",
            "payload": {
                "code": room.code,
                "participant": _participant_to_dict(participant),
                "reconnect": is_reconnect,
            },
        })
    return room


async def start_room(user: User, code: str) -> Room:
    room = get_room(code)
    if str(user.id) != room.host_id:
        raise HTTPException(status_code=403, detail="Only the host can start the room")

    async with room.lock:
        # Re-check status inside the lock so two concurrent /start requests
        # can't both create timer tasks (the second overwriting the first
        # leaks an orphan task that may double-finalize the room).
        if room.status != "lobby":
            raise HTTPException(status_code=409, detail="Room already started or finished")
        room.status = "active"
        room.started_at = datetime.now(timezone.utc)
        room.timer_task = asyncio.create_task(_timer_expiry(code, room.total_time_seconds))

    await manager.send_to_room(room.code, {
        "type": "quiz-room:started",
        "payload": {
            "code": room.code,
            "started_at": room.started_at.isoformat() if room.started_at else None,
            "total_time_seconds": room.total_time_seconds,
            "questions": [_strip_question(q) for q in room.questions],
        },
    })
    await _broadcast_leaderboard(room)
    return room


async def submit_live_answer(
    user: User,
    code: str,
    question_id: uuid.UUID,
    selected_option: str | None,
    is_skipped: bool,
) -> Room:
    room = get_room(code)
    if room.status != "active":
        raise HTTPException(status_code=409, detail="Room is not active")

    user_id = str(user.id)
    participant = room.participants.get(user_id)
    if participant is None:
        raise HTTPException(status_code=403, detail="You are not a participant")
    if participant.role != "player":
        raise HTTPException(status_code=403, detail="Hosts cannot answer")
    if participant.finished_at is not None:
        raise HTTPException(status_code=409, detail="You already finished")

    if is_skipped and selected_option:
        raise HTTPException(status_code=400, detail="Cannot both skip and answer")

    qid = str(question_id)
    question = next((q for q in room.questions if q["id"] == qid), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not in this room")

    async with room.lock:
        prev = participant.answers.get(qid)
        was_correct = bool(prev and prev.get("is_correct"))
        was_answered = bool(
            prev and not prev.get("is_skipped") and prev.get("selected_option")
        )

        is_correct = False
        if not is_skipped and selected_option:
            is_correct = selected_option.upper() == question["correct_option"]

        is_now_answered = bool(selected_option) and not is_skipped
        participant.answers[qid] = {
            "selected_option": selected_option.upper() if selected_option else None,
            "is_skipped": is_skipped,
            "is_correct": is_correct,
        }

        if was_correct and not is_correct:
            participant.correct_count -= 1
        elif not was_correct and is_correct:
            participant.correct_count += 1

        if was_answered and not is_now_answered:
            participant.answered_count -= 1
        elif not was_answered and is_now_answered:
            participant.answered_count += 1

        total = len(room.questions) or 1
        participant.score_percentage = round(participant.correct_count / total * 100, 1)

    await _broadcast_leaderboard(room)
    return room


async def finish_participant(user: User, code: str) -> Room:
    room = get_room(code)
    if room.status != "active":
        raise HTTPException(status_code=409, detail="Room is not active")

    user_id = str(user.id)
    participant = room.participants.get(user_id)
    if participant is None:
        raise HTTPException(status_code=403, detail="You are not a participant")
    if participant.role != "player":
        raise HTTPException(status_code=409, detail="Hosts cannot finish")

    async with room.lock:
        if participant.finished_at is None:
            participant.finished_at = datetime.now(timezone.utc)

        all_done = all(
            p.finished_at is not None
            for p in room.participants.values()
            if p.role == "player"
        )

    await _broadcast_leaderboard(room)
    if all_done:
        await _finalize_room(room)
    return room


async def end_room(user: User, code: str) -> Room:
    room = get_room(code)
    if str(user.id) != room.host_id:
        raise HTTPException(status_code=403, detail="Only the host can end the room")
    if room.status == "finished":
        return room
    await _finalize_room(room, reason="host-ended")
    return room


async def _remove_participant(room: Room, user_id: str) -> Participant | None:
    async with room.lock:
        removed = room.participants.pop(user_id, None)
    if removed is not None:
        manager.leave_room(room.code, user_id)
    return removed


async def leave_room(user: User, code: str) -> None:
    room = get_room(code)
    user_id = str(user.id)
    if user_id == room.host_id:
        raise HTTPException(
            status_code=400,
            detail="Hosts cannot leave; end the room instead.",
        )
    removed = await _remove_participant(room, user_id)
    if removed is None:
        return
    await manager.send_to_room(room.code, {
        "type": "quiz-room:participant-left",
        "payload": {"code": room.code, "user_id": user_id, "kicked": False},
    })
    await _broadcast_leaderboard(room)


async def kick_participant(host: User, code: str, target_user_id: str) -> None:
    room = get_room(code)
    if str(host.id) != room.host_id:
        raise HTTPException(status_code=403, detail="Only the host can kick participants")
    if target_user_id == room.host_id:
        raise HTTPException(status_code=400, detail="Host cannot be kicked")
    removed = await _remove_participant(room, target_user_id)
    if removed is None:
        raise HTTPException(status_code=404, detail="Participant not in this room")
    await manager.send_to_room(room.code, {
        "type": "quiz-room:participant-left",
        "payload": {"code": room.code, "user_id": target_user_id, "kicked": True},
    })
    # Send directly to the kicked user too — they may be the only listener
    # we just removed from the room channel.
    await manager.send_to_user(target_user_id, {
        "type": "quiz-room:kicked",
        "payload": {"code": room.code},
    })
    await _broadcast_leaderboard(room)


def list_my_rooms(user: User) -> list[Room]:
    """Active (lobby/active) rooms where the user is a participant."""
    user_id = str(user.id)
    return [
        room for room in _rooms.values()
        if room.status != "finished" and user_id in room.participants
    ]


async def mark_disconnected(user_id: str) -> None:
    """Called from the WS endpoint when a connection drops.

    Schedules a delayed flip to connected=False after DISCONNECT_GRACE_SECONDS.
    A reconnect within the grace window cancels the pending task (see
    join_room), so brief network blips don't churn the leaderboard.
    """
    # Already connected via another tab — nothing to do.
    if manager.is_connected(user_id):
        return
    # Replace any existing pending task with a fresh one.
    existing = _disconnect_tasks.pop(user_id, None)
    if existing and not existing.done():
        existing.cancel()
    _disconnect_tasks[user_id] = asyncio.create_task(_apply_disconnect(user_id))


async def _apply_disconnect(user_id: str) -> None:
    try:
        await asyncio.sleep(DISCONNECT_GRACE_SECONDS)
    except asyncio.CancelledError:
        return
    finally:
        _disconnect_tasks.pop(user_id, None)
    # Re-check: a new tab may have connected during the grace window.
    if manager.is_connected(user_id):
        return
    affected: list[str] = []
    for room in _rooms.values():
        p = room.participants.get(user_id)
        if p and p.connected:
            p.connected = False
            affected.append(room.code)
    for code in affected:
        await manager.send_to_room(code, {
            "type": "quiz-room:participant-left",
            "payload": {"code": code, "user_id": user_id, "kicked": False},
        })


async def _timer_expiry(code: str, total_time: int) -> None:
    try:
        await asyncio.sleep(total_time)
    except asyncio.CancelledError:
        return
    room = _rooms.get(code)
    if room and room.status == "active":
        await _finalize_room(room)


async def _finalize_room(room: Room, reason: str | None = None) -> None:
    async with room.lock:
        if room.status == "finished":
            return
        room.status = "finished"
        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        room.timer_task = None

        # Auto-finalize anyone still mid-quiz so leaderboard scores are stable.
        now = datetime.now(timezone.utc)
        for p in room.participants.values():
            if p.role == "player" and p.finished_at is None:
                p.finished_at = now

    if reason == "host-ended":
        await manager.send_to_room(room.code, {
            "type": "quiz-room:closed",
            "payload": {"code": room.code, "reason": "host-ended"},
        })

    await manager.send_to_room(room.code, {
        "type": "quiz-room:finished",
        "payload": {
            "code": room.code,
            "final_leaderboard": _build_leaderboard(room, reveal_scores=True),
            "questions_with_answers": room.questions,
        },
    })

    asyncio.create_task(_cleanup_room_after(room.code, CLEANUP_DELAY_SECONDS))


async def _cleanup_room_after(code: str, delay: int) -> None:
    try:
        await asyncio.sleep(delay)
    except asyncio.CancelledError:
        pass
    _rooms.pop(code, None)
    manager.clear_room(code)


def _build_leaderboard(room: Room, reveal_scores: bool) -> list[dict]:
    players = [p for p in room.participants.values() if p.role == "player"]
    sorted_players = sorted(
        players,
        key=lambda p: (
            -p.correct_count,
            (p.finished_at or datetime.max.replace(tzinfo=timezone.utc)),
            p.joined_at,
        ),
    )
    out: list[dict] = []
    for rank, p in enumerate(sorted_players, start=1):
        entry: dict = {
            "user_id": p.user_id,
            "name": p.name,
            "rank": rank,
            "answered_count": p.answered_count,
            "finished": p.finished_at is not None,
            "connected": p.connected,
        }
        if reveal_scores:
            entry["correct_count"] = p.correct_count
            entry["score_percentage"] = p.score_percentage
            entry["total_questions"] = len(room.questions)
            if p.finished_at and room.started_at:
                entry["time_taken_seconds"] = max(
                    0, int((p.finished_at - room.started_at).total_seconds())
                )
        out.append(entry)
    return out


async def _broadcast_leaderboard(room: Room) -> None:
    await manager.send_to_room(room.code, {
        "type": "quiz-room:leaderboard-updated",
        "payload": {
            "code": room.code,
            "leaderboard": _build_leaderboard(room, reveal_scores=False),
        },
    })


def room_to_snapshot(room: Room, requesting_user_id: str) -> dict:
    """Public snapshot for GET /api/quiz-rooms/{code}.

    Strips correct answers (correct_option, explanation) unless the room
    has finished. We deliberately do NOT reveal answers early to a player
    who clicked Finish first, since they could share them with players
    still in the round.
    """
    requester = room.participants.get(requesting_user_id)
    revealed = room.status == "finished"
    questions: list[dict]
    if room.status == "lobby":
        questions = []
    elif revealed:
        questions = room.questions
    else:
        questions = [_strip_question(q) for q in room.questions]

    return {
        "code": room.code,
        "quiz_source": room.quiz_source,
        "quiz_set_id": room.quiz_set_id,
        "quiz_set_name": room.quiz_set_name,
        "topic_id": room.topic_id,
        "topic_title": room.topic_title,
        "quiz_name": room.topic_title if room.quiz_source == "topic" else room.quiz_set_name,
        "host_id": room.host_id,
        "host_type": room.host_type,
        "status": room.status,
        "total_time_seconds": room.total_time_seconds,
        "started_at": room.started_at.isoformat() if room.started_at else None,
        "questions": questions,
        "participants": [_participant_to_dict(p) for p in room.participants.values()],
        "leaderboard": _build_leaderboard(room, reveal_scores=revealed),
        "your_answers": requester.answers if requester else {},
        "you_finished": requester.finished_at is not None if requester else False,
        "you_role": requester.role if requester else None,
    }
