import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.schemas.notification import NotificationOut
from app.websocket_manager import manager


async def create_and_notify(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID,
    message: str,
    notification_type: str | None = None,
    reference_id: uuid.UUID | None = None,
) -> NotificationOut:
    """Create a notification record and push it via WebSocket."""
    notification = Notification(
        recipient_id=recipient_id,
        sender_id=sender_id,
        message=message,
        notification_type=notification_type,
        reference_id=reference_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    out = NotificationOut(
        id=str(notification.id),
        recipient_id=str(notification.recipient_id),
        sender_id=str(notification.sender_id),
        message=notification.message,
        is_read=notification.is_read,
        notification_type=notification.notification_type,
        reference_id=str(notification.reference_id) if notification.reference_id else None,
        created_at=notification.created_at,
    )

    await manager.send_to_user(
        str(notification.recipient_id),
        {
            "type": "notification:created",
            "payload": out.model_dump(mode="json"),
        },
    )

    return out
