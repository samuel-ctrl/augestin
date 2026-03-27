from datetime import datetime

from pydantic import BaseModel


class QuizSetCreate(BaseModel):
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    subject_id: str
    sort_order: int = 0


class QuizSetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    sort_order: int | None = None


class QuizSetOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    subject_id: str
    created_by: str
    sort_order: int
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
    subject_id: str
    subject_name: str
    question_count: int = 0
    progress: dict | None = None

    model_config = {"from_attributes": True}
