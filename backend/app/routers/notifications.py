import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_tutor
from app.models.notification import Notification
from app.models.user import User, UserType
from app.schemas.notification import NotificationCreate, NotificationOut
from app.services.notification_service import create_and_notify

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the current user (most recent first)."""
    user = get_current_user(request)

    query = (
        select(Notification)
        .where(Notification.recipient_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        NotificationOut(
            id=str(n.id),
            recipient_id=str(n.recipient_id),
            sender_id=str(n.sender_id),
            message=n.message,
            is_read=n.is_read,
            notification_type=n.notification_type,
            reference_id=str(n.reference_id) if n.reference_id else None,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.get("/unread-count")
async def unread_count(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Return the number of unread notifications for the current user."""
    user = get_current_user(request)

    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == user.id,
            Notification.is_read == False,
        )
    )
    count = result.scalar_one()
    return {"count": count}


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def send_notification(
    body: NotificationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a notification to a user (tutor only)."""
    tutor = require_tutor(request)

    try:
        recipient_id = uuid.UUID(body.recipient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid recipient_id")

    # Verify recipient exists
    result = await db.execute(select(User).where(User.id == recipient_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    out = await create_and_notify(
        db,
        recipient_id=recipient_id,
        sender_id=tutor.id,
        message=body.message,
        notification_type="manual",
    )

    return out


@router.put("/read-all")
async def mark_all_read(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    user = get_current_user(request)

    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    user = get_current_user(request)

    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    return {"ok": True}
