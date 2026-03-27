from datetime import datetime

from pydantic import BaseModel


class RecapCreate(BaseModel):
    title: str
    content: dict


class RecapUpdate(BaseModel):
    title: str | None = None
    content: dict | None = None


class RecapOut(BaseModel):
    id: str
    book_id: str
    created_by: str
    title: str
    content: dict
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
