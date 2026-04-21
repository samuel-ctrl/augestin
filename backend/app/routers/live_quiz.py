"""REST endpoints for multiplayer live quiz rooms.

Rooms are ephemeral and in-memory; see app/services/live_quiz.py.
"""
import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.services import live_quiz

router = APIRouter(prefix="/api/quiz-rooms", tags=["quiz_rooms"])


class CreateRoomRequest(BaseModel):
    quiz_set_id: uuid.UUID
    total_time_seconds: int | None = Field(
        default=None,
        ge=live_quiz.MIN_TIME_SECONDS,
        le=live_quiz.MAX_TIME_SECONDS,
        description="Override the default quiz duration. Defaults to sum of question time limits.",
    )


class AnswerRequest(BaseModel):
    question_id: uuid.UUID
    selected_option: str | None = Field(default=None, pattern="^[ABCDabcd]$")
    is_skipped: bool = False


class ParticipantOut(BaseModel):
    user_id: str
    name: str
    role: str
    joined_at: str
    connected: bool
    finished: bool


class LeaderboardEntryOut(BaseModel):
    user_id: str
    name: str
    rank: int
    answered_count: int
    finished: bool
    connected: bool
    correct_count: int | None = None
    score_percentage: float | None = None
    total_questions: int | None = None


class RoomSnapshotOut(BaseModel):
    code: str
    quiz_set_id: str
    quiz_set_name: str
    host_id: str
    host_type: str
    status: str
    total_time_seconds: int
    started_at: str | None
    questions: list[dict]
    participants: list[ParticipantOut]
    leaderboard: list[LeaderboardEntryOut]
    your_answers: dict[str, dict]
    you_finished: bool
    you_role: str | None


def _snapshot(room: live_quiz.Room, user_id: str) -> dict:
    return live_quiz.room_to_snapshot(room, user_id)


@router.get("/mine", response_model=list[RoomSnapshotOut])
async def list_my_rooms(request: Request):
    """List active (lobby/active) rooms the caller is in."""
    user = get_current_user(request)
    return [_snapshot(r, str(user.id)) for r in live_quiz.list_my_rooms(user)]


@router.post("", response_model=RoomSnapshotOut)
async def create_room(
    body: CreateRoomRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)
    room = await live_quiz.create_room(
        db, user, body.quiz_set_id, total_time_seconds=body.total_time_seconds,
    )
    return _snapshot(room, str(user.id))


@router.post("/{code}/join", response_model=RoomSnapshotOut)
async def join_room(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)
    room = await live_quiz.join_room(db, user, code.upper())
    return _snapshot(room, str(user.id))


@router.post("/{code}/start", response_model=RoomSnapshotOut)
async def start_room(code: str, request: Request):
    user = get_current_user(request)
    room = await live_quiz.start_room(user, code.upper())
    return _snapshot(room, str(user.id))


@router.post("/{code}/answer", response_model=RoomSnapshotOut)
async def submit_answer(
    code: str,
    body: AnswerRequest,
    request: Request,
):
    user = get_current_user(request)
    room = await live_quiz.submit_live_answer(
        user,
        code.upper(),
        body.question_id,
        body.selected_option,
        body.is_skipped,
    )
    return _snapshot(room, str(user.id))


@router.post("/{code}/complete", response_model=RoomSnapshotOut)
async def complete(code: str, request: Request):
    user = get_current_user(request)
    room = await live_quiz.finish_participant(user, code.upper())
    return _snapshot(room, str(user.id))


@router.post("/{code}/leave", status_code=204)
async def leave(code: str, request: Request):
    user = get_current_user(request)
    await live_quiz.leave_room(user, code.upper())


@router.post("/{code}/kick/{user_id}", status_code=204)
async def kick(code: str, user_id: str, request: Request):
    host = get_current_user(request)
    await live_quiz.kick_participant(host, code.upper(), user_id)


@router.post("/{code}/end", response_model=RoomSnapshotOut)
async def end_room(code: str, request: Request):
    user = get_current_user(request)
    room = await live_quiz.end_room(user, code.upper())
    return _snapshot(room, str(user.id))


@router.get("/{code}", response_model=RoomSnapshotOut)
async def get_room(code: str, request: Request):
    user = get_current_user(request)
    room = live_quiz.get_room(code.upper())
    return _snapshot(room, str(user.id))
