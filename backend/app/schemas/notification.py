from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationCreate(BaseModel):
    recipient_id: str
    message: str


class NotificationOut(BaseModel):
    id: str
    recipient_id: str
    # None for system-generated notifications (e.g. streak warnings), which
    # have no human sender.
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    message: str
    is_read: bool
    notification_type: Optional[str] = None
    reference_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
