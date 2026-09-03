import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.schemas.notification import NotificationOut
from app.websocket_manager import manager


async def build_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID | None,
    message: str,
    notification_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    sender_name: str | None = None,
) -> NotificationOut:
    """Create a notification row in the caller's transaction, WITHOUT committing.

    Split out of create_and_notify so a caller that needs several writes to
    land atomically (see services/streak.py) can do its own single commit and
    push afterwards. Callers that just want fire-and-forget should keep using
    create_and_notify.

    `sender_id=None` means system-generated: there is no human sender, so the
    name is left null rather than falling back to "Unknown". The UI already
    guards both the name and its separator, so a null sender simply renders
    nothing — no "System" label needed.
    """
    notification = Notification(
        recipient_id=recipient_id,
        sender_id=sender_id,
        message=message,
        notification_type=notification_type,
        reference_id=reference_id,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)

    if sender_id is None:
        sender_name = None
    elif not sender_name:
        from app.models.user import User
        from sqlalchemy import select as sa_select
        result = await db.execute(sa_select(User.name).where(User.id == sender_id))
        sender_name = result.scalar_one_or_none() or "Unknown"

    return NotificationOut(
        id=str(notification.id),
        recipient_id=str(notification.recipient_id),
        sender_id=str(notification.sender_id) if notification.sender_id else None,
        sender_name=sender_name,
        message=notification.message,
        is_read=notification.is_read,
        notification_type=notification.notification_type,
        reference_id=str(notification.reference_id) if notification.reference_id else None,
        created_at=notification.created_at,
    )


async def push_notification(out: NotificationOut) -> None:
    """Push an already-persisted notification to its recipient via WebSocket."""
    await manager.send_to_user(
        out.recipient_id,
        {
            "type": "notification:created",
            "payload": out.model_dump(mode="json"),
        },
    )


async def create_and_notify(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID | None,
    message: str,
    notification_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    sender_name: str | None = None,
) -> NotificationOut:
    """Create a notification record, commit, and push it via WebSocket."""
    out = await build_notification(
        db,
        recipient_id=recipient_id,
        sender_id=sender_id,
        message=message,
        notification_type=notification_type,
        reference_id=reference_id,
        sender_name=sender_name,
    )
    await db.commit()
    await push_notification(out)
    return out
