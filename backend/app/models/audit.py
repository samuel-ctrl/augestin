"""
AuditBase — abstract base model with common audit fields for all tables.

Provides: id, created_at, updated_at, version, created_by, updated_by,
created_by_name, updated_by_name.

These fields are auto-populated by the audit event listener in app.audit.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditBase(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Audit user fields (auto-set by event listener)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by_name: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_by_name: Mapped[str | None] = mapped_column(String, nullable=True)
