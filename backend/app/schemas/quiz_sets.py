from datetime import datetime

from pydantic import BaseModel


class QuizSetCreate(BaseModel):
    name: str
    description: str | None = None
    thumbnail_url: str | None = None


class QuizSetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None


class QuizSetOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    created_by: str
    question_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class QuizSetAssignCreate(BaseModel):
    student_id: str


class QuizSetAssignOut(BaseModel):
    id: str
    quiz_set_id: str
    student_id: str
    student_name: str
    student_login_id: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AssignedQuizSetOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    question_count: int = 0
    progress: dict | None = None

    model_config = {"from_attributes": True}


class QuizSetLeaderboardEntryOut(BaseModel):
    student_id: str
    student_name: str
    student_login_id: str
    rank: int
    score_percentage: float
    correct_count: int
    total_questions: int
    total_time_seconds: int
    completed_at: datetime
