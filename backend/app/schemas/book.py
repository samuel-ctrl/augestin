from datetime import datetime

from pydantic import BaseModel


class BookOut(BaseModel):
    id: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    video_url: str
    video_duration_seconds: float | None = None
    standard: str
    sort_order: int = 0
    subject_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    # Student-specific fields (populated when student requests)
    watch_percentage: float | None = None
    last_position_seconds: float | None = None
    completed: bool | None = None

    model_config = {"from_attributes": True}
