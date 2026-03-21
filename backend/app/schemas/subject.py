from datetime import datetime

from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    icon: str | None = "book"


class SubjectUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None


class SubjectOut(BaseModel):
    id: str
    name: str
    icon: str | None = "book"
    created_by: str
    book_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
