from datetime import datetime

from pydantic import BaseModel


class BookRecapCreate(BaseModel):
    title: str
    content: dict


class BookRecapOut(BaseModel):
    id: str
    book_id: str
    student_id: str
    title: str
    content: dict
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
