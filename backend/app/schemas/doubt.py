from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class DoubtCreate(BaseModel):
    title: str
    description: str
    book_id: str | None = None
    attachment_links: list[str] = []


class DoubtUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class DoubtStatusUpdate(BaseModel):
    status: Literal["open", "resolved", "closed"]


class DoubtCommentCreate(BaseModel):
    content: str


class DoubtCommentUpdate(BaseModel):
    content: str


class DoubtCommentOut(BaseModel):
    id: str
    doubt_id: str
    user_id: str
    user_name: str
    user_type: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DoubtOut(BaseModel):
    id: str
    title: str
    description: str
    status: str
    student_id: str
    student_name: str
    book_id: str | None = None
    book_title: str | None = None
    attachment_links: list[str] = []
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DoubtDetailOut(DoubtOut):
    comments: list[DoubtCommentOut] = []
