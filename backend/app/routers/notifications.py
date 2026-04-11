import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_tutor
from app.models.notification import Notification
from app.models.user import User, UserType
from app.schemas.notification import NotificationCreate, NotificationOut
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import create_and_notify

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=PaginatedResponse[NotificationOut])
async def list_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
):
    """List notifications for the current user (most recent first)."""
    user = get_current_user(request)

    base_where = [Notification.recipient_id == user.id]
    if date_from:
        base_where.append(
            Notification.created_at >= datetime.combine(date_from, datetime.min.time())
        )
    if date_to:
        base_where.append(
            Notification.created_at
            < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )

    # Count total
    count_query = select(func.count(Notification.id)).where(*base_where)
    total = (await db.execute(count_query)).scalar() or 0

    # Paginated query
    offset = (page - 1) * page_size
    query = (
        select(Notification, User.name)
        .join(User, Notification.sender_id == User.id)
        .where(*base_where)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    rows = result.all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return PaginatedResponse(
        items=[
            NotificationOut(
                id=str(n.id),
                recipient_id=str(n.recipient_id),
                sender_id=str(n.sender_id),
                sender_name=sender_name,
                message=n.message,
                is_read=n.is_read,
                notification_type=n.notification_type,
                reference_id=str(n.reference_id) if n.reference_id else None,
                created_at=n.created_at,
            )
            for n, sender_name in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


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
