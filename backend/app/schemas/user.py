from datetime import datetime

from pydantic import BaseModel


class StudentCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    standard: str | None = None


class StudentCreateResponse(BaseModel):
    id: str
    login_id: str
    name: str
    password: str  # plain text, shown once


class StudentOut(BaseModel):
    id: str
    login_id: str
    name: str
    email: str | None = None
    phone: str | None = None
    standard: str | None = None
    must_change_password: bool
    assignment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookProgressOut(BaseModel):
    book_id: str
    book_title: str
    subject_id: str
    watch_percentage: float
    last_position_seconds: float
    completed: bool
    last_watched_at: str | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    standard: str | None = None


class ResetPasswordResponse(BaseModel):
    login_id: str
    password: str  # new plain text password
