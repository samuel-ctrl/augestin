from datetime import datetime

from pydantic import BaseModel


class NotificationCreate(BaseModel):
    student_id: str
    message: str


class NotificationOut(BaseModel):
    id: str
    student_id: str
    sender_id: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
