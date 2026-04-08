import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_tutor
from app.models.notification import Notification
from app.models.user import User, UserType
from app.schemas.notification import NotificationCreate, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the current student (most recent first)."""
    user = get_current_user(request)

    query = (
        select(Notification)
        .where(Notification.student_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        NotificationOut(
            id=str(n.id),
            student_id=str(n.student_id),
            sender_id=str(n.sender_id),
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def send_notification(
    body: NotificationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a notification to a student (tutor only)."""
    tutor = require_tutor(request)

    try:
        student_id = uuid.UUID(body.student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid student_id")

    # Verify student exists
    result = await db.execute(
        select(User).where(User.id == student_id, User.user_type == UserType.student)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    notification = Notification(
        student_id=student_id,
        sender_id=tutor.id,
        message=body.message,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    return NotificationOut(
        id=str(notification.id),
        student_id=str(notification.student_id),
        sender_id=str(notification.sender_id),
        message=notification.message,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


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
            Notification.student_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    return {"ok": True}
