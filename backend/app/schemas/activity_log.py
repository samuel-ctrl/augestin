from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ActivityLogOut(BaseModel):
    id: str
    started_at: datetime
    ended_at: datetime
    duration_ms: int | None = None

    actor_id: str | None = None
    actor_name: str | None = None
    actor_type: str | None = None

    action: str
    action_label: str
    method: str
    path: str

    target_type: str | None = None
    target_id: str | None = None
    target_name: str | None = None

    status_code: int | None = None
    outcome: str | None = None
    error_message: str | None = None

    ip_address: str | None = None
    user_agent: str | None = None
    request_id: str | None = None

    meta: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class ActivityActionOut(BaseModel):
    value: str
    label: str
