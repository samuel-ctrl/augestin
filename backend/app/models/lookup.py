from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.audit import AuditBase


class Standard(AuditBase):
    __tablename__ = "standards"

    name: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Section(AuditBase):
    __tablename__ = "sections"

    name: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
