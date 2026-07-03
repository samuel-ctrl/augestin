from datetime import datetime

from pydantic import BaseModel


class TopicCreate(BaseModel):
    title: str
    video_url: str | None = None
    image_url: str | None = None


class TopicUpdate(BaseModel):
    title: str | None = None
    video_url: str | None = None
    image_url: str | None = None


class ReorderTopicsRequest(BaseModel):
    topic_ids: list[str]


class TopicOut(BaseModel):
    id: str
    book_id: str
    title: str
    position: int
    video_url: str | None = None
    image_url: str | None = None
    has_notes: bool = False
    question_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class TopicProgressOut(BaseModel):
    topic_id: str
    topic_title: str
    position: int
    has_video: bool
    has_image: bool
    image_url: str | None = None
    is_unlocked: bool
    is_complete: bool
    video_complete: bool
    quiz_complete: bool
    question_count: int
    score_percentage: float | None = None


class TopicNotesCreate(BaseModel):
    title: str
    content: dict


class TopicNotesOut(BaseModel):
    id: str
    topic_id: str
    title: str
    content: dict
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
