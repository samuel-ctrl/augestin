import math
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_tutor
from app.models.activity_log import ActivityLog
from app.schemas.activity_log import (
    ActivityActionOut,
    ActivityLogOut,
    BulkDeleteRequest,
    BulkDeleteResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.services.activity_log import bulk_delete_logs
from app.services.activity_log_labels import ACTION_LABELS, label_for

router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])


SORTABLE_FIELDS = {
    "started_at": ActivityLog.started_at,
    "ended_at": ActivityLog.ended_at,
    "duration_ms": ActivityLog.duration_ms,
    "actor_name": ActivityLog.actor_name,
    "action": ActivityLog.action,
    "status_code": ActivityLog.status_code,
    "outcome": ActivityLog.outcome,
}


def _row_to_out(row: ActivityLog) -> ActivityLogOut:
    return ActivityLogOut(
        id=str(row.id),
        started_at=row.started_at,
        ended_at=row.ended_at,
        duration_ms=row.duration_ms,
        actor_id=str(row.actor_id) if row.actor_id else None,
        actor_name=row.actor_name,
        actor_type=row.actor_type,
        action=row.action,
        action_label=label_for(row.action),
        method=row.method,
        path=row.path,
        target_type=row.target_type,
        target_id=str(row.target_id) if row.target_id else None,
        target_name=row.target_name,
        status_code=row.status_code,
        outcome=row.outcome,
        error_message=row.error_message,
        ip_address=row.ip_address,
        user_agent=row.user_agent,
        request_id=row.request_id,
        meta=row.meta,
    )


@router.get("", response_model=PaginatedResponse[ActivityLogOut])
async def list_activity_logs(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    sort_by: str = Query("ended_at"),
    sort_order: str = Query("desc"),
    actor_type: str | None = Query(None),
    action: str | None = Query(None),
    outcome: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)

    query = select(ActivityLog)
    count_query = select(func.count()).select_from(ActivityLog)

    filters = []
    if actor_type:
        filters.append(ActivityLog.actor_type == actor_type)
    if action:
        filters.append(ActivityLog.action == action)
    if outcome:
        filters.append(ActivityLog.outcome == outcome)
    if start_date:
        filters.append(ActivityLog.ended_at >= start_date)
    if end_date:
        filters.append(ActivityLog.ended_at <= end_date)
    if search:
        needle = f"%{search}%"
        filters.append(
            or_(
                ActivityLog.actor_name.ilike(needle),
                ActivityLog.action.ilike(needle),
                ActivityLog.path.ilike(needle),
            )
        )
    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    sort_col = SORTABLE_FIELDS.get(sort_by, ActivityLog.ended_at)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order, ActivityLog.id.desc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    rows = (await db.execute(query)).scalars().all()
    total = (await db.execute(count_query)).scalar() or 0
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return PaginatedResponse(
        items=[_row_to_out(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_activity_logs(
    request: Request,
    body: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    require_tutor(request)
    count = await bulk_delete_logs(
        db,
        start_date=body.start_date,
        end_date=body.end_date,
        outcomes=body.outcomes,
    )
    return BulkDeleteResponse(deleted=count)


@router.get("/actions", response_model=list[ActivityActionOut])
async def list_activity_actions(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Distinct actions present in the log, for the UI filter dropdown.

    Ordered by action label so the dropdown is human-readable.
    """
    require_tutor(request)

    result = await db.execute(
        select(ActivityLog.action).distinct().order_by(ActivityLog.action)
    )
    raw_actions = [r for (r,) in result.all() if r]

    # Include any known actions even if they haven't been recorded yet,
    # so the filter doesn't disappear for empty-log deploys.
    seen = set(raw_actions)
    for known in ACTION_LABELS:
        if known not in seen:
            raw_actions.append(known)
            seen.add(known)

    items = [
        ActivityActionOut(value=a, label=label_for(a))
        for a in sorted(raw_actions, key=lambda x: label_for(x).lower())
    ]
    return items
