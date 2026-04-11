from datetime import datetime

from pydantic import BaseModel


class StandardCreate(BaseModel):
    name: str
    display_order: int | None = None


class StandardUpdate(BaseModel):
    name: str | None = None
    display_order: int | None = None


class StandardOut(BaseModel):
    id: str
    name: str
    display_order: int
    student_count: int = 0
    book_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class SectionCreate(BaseModel):
    name: str
    display_order: int | None = None


class SectionUpdate(BaseModel):
    name: str | None = None
    display_order: int | None = None


class SectionOut(BaseModel):
    id: str
    name: str
    display_order: int
    student_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReorderRequest(BaseModel):
    ids: list[str]


class LookupOption(BaseModel):
    value: str
    label: str


class LookupOptions(BaseModel):
    standards: list[LookupOption] = []
    sections: list[LookupOption] = []
