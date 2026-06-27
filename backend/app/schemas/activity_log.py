from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator


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


class BulkDeleteRequest(BaseModel):
    start_date: datetime | None = None
    end_date: datetime | None = None
    outcomes: list[str] | None = None

    @model_validator(mode="after")
    def require_at_least_one_filter(self) -> "BulkDeleteRequest":
        has_date = self.start_date is not None or self.end_date is not None
        has_outcomes = bool(self.outcomes)
        if not has_date and not has_outcomes:
            raise ValueError("At least one filter (date range or outcomes) must be provided.")
        return self


class BulkDeleteResponse(BaseModel):
    deleted: int
