from datetime import datetime

from pydantic import BaseModel


class TestSetFileCreate(BaseModel):
    file_name: str
    drive_link: str
    instructions: str | None = None


class TestSetFileUpdate(BaseModel):
    file_name: str | None = None
    drive_link: str | None = None
    instructions: str | None = None


class TestSetFileOut(BaseModel):
    id: str
    test_set_id: str
    file_name: str
    drive_link: str
    instructions: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class TestSetCreate(BaseModel):
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    files: list[TestSetFileCreate] | None = None


class TestSetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None


class TestSetOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    created_by: str
    file_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class TestSetDetailOut(TestSetOut):
    files: list[TestSetFileOut] = []


class TestSetAssignCreate(BaseModel):
    student_id: str


class TestSetAssignOut(BaseModel):
    id: str
    test_set_id: str
    student_id: str
    student_name: str
    student_login_id: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class TestSetSubmissionStatus(BaseModel):
    has_submitted: bool
    submitted_at: datetime | None = None


class TestSetSubmissionOut(BaseModel):
    id: str
    test_set_id: str
    student_id: str
    student_name: str
    student_login_id: str
    submitted_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignedTestSetOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    file_count: int = 0
    files: list[TestSetFileOut] = []
    submission_status: TestSetSubmissionStatus | None = None

    model_config = {"from_attributes": True}
