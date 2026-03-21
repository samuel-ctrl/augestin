from datetime import datetime

from pydantic import BaseModel


class AssignRequest(BaseModel):
    book_id: str
    student_ids: list[str]


class AssignmentOut(BaseModel):
    id: str
    book_id: str
    student_id: str
    student_name: str
    student_login_id: str
    assigned_by: str
    assigned_at: datetime

    model_config = {"from_attributes": True}
