from datetime import datetime

from pydantic import BaseModel


class BookTestCreate(BaseModel):
    drive_link: str
    instructions: str | None = None


class BookTestUpdate(BaseModel):
    drive_link: str | None = None
    instructions: str | None = None


class BookTestOut(BaseModel):
    id: str
    book_id: str
    drive_link: str
    instructions: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class TestSubmissionOut(BaseModel):
    id: str
    test_id: str
    student_id: str
    student_name: str
    student_login_id: str
    submitted_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestSubmissionStatus(BaseModel):
    has_submitted: bool
    submitted_at: datetime | None = None
