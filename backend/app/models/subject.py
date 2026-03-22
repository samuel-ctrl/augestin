from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.audit import AuditBase


class Subject(AuditBase):
    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True, default="book")

    # Relationships
    books = relationship("Book", back_populates="subject", cascade="all, delete-orphan")
