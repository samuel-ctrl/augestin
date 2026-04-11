from pydantic import BaseModel


class LoginRequest(BaseModel):
    login_id: str
    password: str


class UserOut(BaseModel):
    id: str
    login_id: str
    name: str
    email: str | None = None
    phone: str | None = None
    user_type: str
    standard: str | None = None
    section: str | None = None
    must_change_password: bool

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
