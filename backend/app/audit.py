"""
SQLAlchemy audit event listener.

Auto-populates created_by, updated_by, created_by_name, updated_by_name,
and version fields on AuditBase models before flush.
"""

import logging

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.context import get_current_logged_user
from app.models.audit import AuditBase

logger = logging.getLogger(__name__)


@event.listens_for(Session, "before_flush")
def _set_audit_fields(session: Session, flush_context, instances):
    try:
        user = get_current_logged_user()

        if not user:
            logger.debug("No current user in context; skipping audit fields")
            return

        # Set for new objects
        for obj in list(session.new):
            if isinstance(obj, AuditBase):
                if not obj.created_by:
                    obj.created_by = user.user_id
                if not obj.created_by_name:
                    obj.created_by_name = user.name
                if not obj.updated_by:
                    obj.updated_by = user.user_id
                if not obj.updated_by_name:
                    obj.updated_by_name = user.name
                if not obj.version:
                    obj.version = 1

        # Set for modified objects
        for obj in list(session.dirty):
            if isinstance(obj, AuditBase):
                obj.updated_by = user.user_id
                obj.updated_by_name = user.name
                if obj.version:
                    obj.version = obj.version + 1
                else:
                    obj.version = 1
    except Exception as e:
        logger.error(f"Error setting audit fields: {e!s}")
        raise


def register_audit_listener():
    """Import this module to register the event listener (happens on import)."""
    logger.info("Audit event listener registered")
