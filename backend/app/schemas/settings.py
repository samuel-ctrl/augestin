from pydantic import BaseModel


class TutorContactOut(BaseModel):
    email: str | None = None
    whatsapp: str | None = None


class TutorContactUpdate(BaseModel):
    email: str | None = None
    whatsapp: str | None = None
