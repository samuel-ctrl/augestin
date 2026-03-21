from pydantic import BaseModel


class ProgressUpdate(BaseModel):
    watch_percentage: float
    last_position_seconds: float


class ResumeBookOut(BaseModel):
    book_id: str
    book_title: str
    subject_id: str
    subject_name: str
    thumbnail_url: str | None = None
    watch_percentage: float
    last_position_seconds: float
