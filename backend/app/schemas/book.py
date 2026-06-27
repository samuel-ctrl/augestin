from datetime import datetime

from pydantic import BaseModel


class BookCreateRequest(BaseModel):
    title: str
    standard: str
    description: str | None = None
    thumbnail_url: str | None = None


class BookUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    standard: str | None = None
    thumbnail_url: str | None = None  # empty string clears the thumbnail


class BookOut(BaseModel):
    id: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    standard: str
    subject_id: str
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    topic_count: int = 0

    model_config = {"from_attributes": True}
