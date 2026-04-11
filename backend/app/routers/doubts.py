import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_student, require_tutor
from app.models.doubt import Doubt as DoubtModel, DoubtComment as DoubtCommentModel
from app.models.user import User, UserType
from app.schemas.doubt import (
    DoubtCreate, DoubtUpdate, DoubtStatusUpdate,
    DoubtOut, DoubtDetailOut,
    DoubtCommentCreate, DoubtCommentUpdate, DoubtCommentOut,
)
from app.schemas.pagination import PaginatedResponse
from app.services.doubt import (
    create_doubt, list_doubts, get_doubt, update_doubt, delete_doubt,
    update_doubt_status, create_comment, get_comment, update_comment, delete_comment,
)
from app.services.notification_service import create_and_notify
from app.websocket_manager import manager

router = APIRouter(tags=["doubts"])


# ============================================================================
# DOUBT CRUD
# ============================================================================

@router.get("/api/doubts", response_model=PaginatedResponse[DoubtOut])
async def list_doubts_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    status_filter: str = Query("", alias="status"),
    book_id: str = Query(""),
    my_doubts: bool = Query(False),
    standard: str = Query(""),
    section: str = Query(""),
):
    user = get_current_user(request)

    student_id = None
    if my_doubts:
        student_id = user.id

    book_uuid = None
    if book_id:
        try:
            book_uuid = uuid.UUID(book_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid book_id")

    # Students only see doubts from their own standard
    effective_standard = standard or None
    effective_section = section or None
    if user.user_type == UserType.student and user.standard:
        effective_standard = user.standard

    items, total, pg, ps, total_pages = await list_doubts(
        db, page=page, page_size=page_size, search=search,
        status_filter=status_filter or None,
        book_id=book_uuid, student_id=student_id,
        standard=effective_standard, section=effective_section,
    )

    return PaginatedResponse(
        items=[DoubtOut(**item) for item in items],
        total=total, page=pg, page_size=ps, total_pages=total_pages,
    )


@router.post("/api/doubts", response_model=DoubtOut, status_code=status.HTTP_201_CREATED)
async def create_doubt_endpoint(
    body: DoubtCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    student = require_student(request)

    book_uuid = None
    if body.book_id:
        try:
            book_uuid = uuid.UUID(body.book_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid book_id")

    try:
        doubt = await create_doubt(
            db, student_id=student.id,
            title=body.title, description=body.description,
            book_id=book_uuid,
            attachment_links=body.attachment_links,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    out = DoubtOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=student.name,
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=None,
        attachment_links=doubt.attachment_links or [],
        comment_count=0,
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
    )

    # Notify all tutors about the new doubt
    tutor_result = await db.execute(
        select(User.id).where(User.user_type == UserType.tutor)
    )
    tutor_ids = [str(uid) for uid in tutor_result.scalars().all()]

    for tid in tutor_ids:
        await create_and_notify(
            db,
            recipient_id=uuid.UUID(tid),
            sender_id=student.id,
            message=f"{student.name} posted a new doubt: '{doubt.title}'",
            notification_type="doubt_created",
            reference_id=doubt.id,
        )

    return out


@router.get("/api/doubts/{doubt_id}", response_model=DoubtDetailOut)
async def get_doubt_endpoint(
    doubt_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    get_current_user(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    comments = [
        DoubtCommentOut(
            id=str(c.id),
            doubt_id=str(c.doubt_id),
            user_id=str(c.user_id),
            user_name=c.user.name if c.user else "",
            user_type=c.user.user_type if c.user else "",
            content=c.content,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in sorted(doubt.comments, key=lambda x: x.created_at)
    ]

    return DoubtDetailOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=doubt.student.name if doubt.student else "",
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=doubt.book.title if doubt.book else None,
        attachment_links=doubt.attachment_links or [],
        comment_count=len(doubt.comments),
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
        comments=comments,
    )


@router.put("/api/doubts/{doubt_id}", response_model=DoubtOut)
async def update_doubt_endpoint(
    doubt_id: uuid.UUID,
    body: DoubtUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    # Students can only edit their own doubts
    if user.user_type == UserType.student and str(doubt.student_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own doubts")

    await update_doubt(db, doubt, title=body.title, description=body.description, attachment_links=body.attachment_links)

    # Re-fetch with eager-loaded relationships (commit expires them)
    doubt = await get_doubt(db, doubt_id)

    out = DoubtOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=doubt.student.name if doubt.student else "",
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=doubt.book.title if doubt.book else None,
        attachment_links=doubt.attachment_links or [],
        comment_count=len(doubt.comments),
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
    )

    # Notify participants about the doubt edit
    if user.user_type == UserType.student:
        # Student edited → notify all tutors
        tutor_result = await db.execute(
            select(User.id).where(User.user_type == UserType.tutor)
        )
        recipient_ids = [str(uid) for uid in tutor_result.scalars().all()]
    else:
        # Tutor edited → notify the student who raised the doubt
        recipient_ids = [str(doubt.student_id)]

    # Exclude the editor themselves
    recipient_ids = [rid for rid in recipient_ids if rid != str(user.id)]

    if recipient_ids:
        await manager.send_to_users(
            recipient_ids,
            {
                "type": "doubt:edited",
                "payload": out.model_dump(mode="json"),
            },
        )

        for rid in recipient_ids:
            await create_and_notify(
                db,
                recipient_id=uuid.UUID(rid),
                sender_id=user.id,
                message=f"{user.name} edited doubt: '{doubt.title}'",
                notification_type="doubt_edited",
                reference_id=doubt.id,
            )

    return out


@router.post("/api/doubts/{doubt_id}/request-delete", status_code=status.HTTP_200_OK)
async def request_delete_doubt_endpoint(
    doubt_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Student requests deletion of their doubt. Tutors are notified and can proceed."""
    student = require_student(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    if str(doubt.student_id) != str(student.id):
        raise HTTPException(status_code=403, detail="You can only request deletion of your own doubts")

    # Notify all tutors
    tutor_result = await db.execute(
        select(User.id).where(User.user_type == UserType.tutor)
    )
    tutor_ids = [str(uid) for uid in tutor_result.scalars().all()]

    for tid in tutor_ids:
        await create_and_notify(
            db,
            recipient_id=uuid.UUID(tid),
            sender_id=student.id,
            message=f"{student.name} requested deletion of doubt: '{doubt.title}'",
            notification_type="doubt_delete_request",
            reference_id=doubt.id,
        )

    return {"detail": "Deletion request sent to tutors"}


@router.delete("/api/doubts/{doubt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doubt_endpoint(
    doubt_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    result = await db.execute(select(DoubtModel).where(DoubtModel.id == doubt_id))
    doubt = result.scalar_one_or_none()
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    await delete_doubt(db, doubt)


@router.patch("/api/doubts/{doubt_id}/status", response_model=DoubtOut)
async def update_doubt_status_endpoint(
    doubt_id: uuid.UUID,
    body: DoubtStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)

    doubt = await get_doubt(db, doubt_id)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    await update_doubt_status(db, doubt, body.status)

    # Re-fetch with eager-loaded relationships (commit expires them)
    doubt = await get_doubt(db, doubt_id)

    # Notify the student who raised the doubt
    await create_and_notify(
        db,
        recipient_id=doubt.student_id,
        sender_id=tutor.id,
        message=f"{tutor.name} marked your doubt '{doubt.title}' as {body.status}",
        notification_type="doubt_status",
        reference_id=doubt_id,
    )

    return DoubtOut(
        id=str(doubt.id),
        title=doubt.title,
        description=doubt.description,
        status=doubt.status,
        student_id=str(doubt.student_id),
        student_name=doubt.student.name if doubt.student else "",
        book_id=str(doubt.book_id) if doubt.book_id else None,
        book_title=doubt.book.title if doubt.book else None,
        attachment_links=doubt.attachment_links or [],
        comment_count=len(doubt.comments),
        created_at=doubt.created_at,
        updated_at=doubt.updated_at,
    )


# ============================================================================
# COMMENTS
# ============================================================================

@router.post("/api/doubts/{doubt_id}/comments", response_model=DoubtCommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment_endpoint(
    doubt_id: uuid.UUID,
    body: DoubtCommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    doubt_result = await db.execute(select(DoubtModel).where(DoubtModel.id == doubt_id))
    doubt_obj = doubt_result.scalar_one_or_none()
    if not doubt_obj:
        raise HTTPException(status_code=404, detail="Doubt not found")

    comment = await create_comment(db, doubt_id, user.id, body.content)

    out = DoubtCommentOut(
        id=str(comment.id),
        doubt_id=str(comment.doubt_id),
        user_id=str(comment.user_id),
        user_name=user.name,
        user_type=user.user_type,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )

    # Gather all participants (doubt owner + all commenters) except the current user
    participant_result = await db.execute(
        select(DoubtCommentModel.user_id)
        .where(DoubtCommentModel.doubt_id == doubt_id)
        .distinct()
    )
    participant_ids = {str(uid) for uid in participant_result.scalars().all()}
    participant_ids.add(str(doubt_obj.student_id))

    # If a student comments, ensure all tutors are notified (not just existing commenters)
    if user.user_type == UserType.student:
        tutor_result = await db.execute(
            select(User.id).where(User.user_type == UserType.tutor)
        )
        participant_ids.update(str(uid) for uid in tutor_result.scalars().all())

    participant_ids.discard(str(user.id))

    if participant_ids:
        # Real-time comment update for doubt detail page
        await manager.send_to_users(
            list(participant_ids),
            {
                "type": "doubt_comment:created",
                "payload": out.model_dump(mode="json"),
            },
        )

        # Create persistent notification records for each participant
        for pid in participant_ids:
            await create_and_notify(
                db,
                recipient_id=uuid.UUID(pid),
                sender_id=user.id,
                message=f"{user.name} commented on '{doubt_obj.title}'",
                notification_type="doubt_comment",
                reference_id=doubt_id,
            )

    return out


@router.put("/api/doubts/{doubt_id}/comments/{comment_id}", response_model=DoubtCommentOut)
async def update_comment_endpoint(
    doubt_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: DoubtCommentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    comment = await get_comment(db, comment_id)
    if not comment or comment.doubt_id != doubt_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if user.user_type == UserType.student and str(comment.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    comment = await update_comment(db, comment, body.content)

    # Resolve the comment author's name (may differ from request user if tutor edits)
    author_result = await db.execute(select(User).where(User.id == comment.user_id))
    author = author_result.scalar_one_or_none()

    out = DoubtCommentOut(
        id=str(comment.id),
        doubt_id=str(comment.doubt_id),
        user_id=str(comment.user_id),
        user_name=author.name if author else "",
        user_type=author.user_type if author else "",
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )

    # Notify all participants (doubt owner + commenters) except the editor
    doubt_obj_result = await db.execute(select(DoubtModel).where(DoubtModel.id == doubt_id))
    doubt_obj = doubt_obj_result.scalar_one_or_none()

    participant_result = await db.execute(
        select(DoubtCommentModel.user_id)
        .where(DoubtCommentModel.doubt_id == doubt_id)
        .distinct()
    )
    participant_ids = {str(uid) for uid in participant_result.scalars().all()}
    if doubt_obj:
        participant_ids.add(str(doubt_obj.student_id))
    participant_ids.discard(str(user.id))

    if participant_ids:
        await manager.send_to_users(
            list(participant_ids),
            {
                "type": "doubt_comment:edited",
                "payload": out.model_dump(mode="json"),
            },
        )

        doubt_title = doubt_obj.title if doubt_obj else "a doubt"
        for pid in participant_ids:
            await create_and_notify(
                db,
                recipient_id=uuid.UUID(pid),
                sender_id=user.id,
                message=f"{user.name} edited a comment on '{doubt_title}'",
                notification_type="doubt_comment_edited",
                reference_id=doubt_id,
            )

    return out


@router.delete("/api/doubts/{doubt_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment_endpoint(
    doubt_id: uuid.UUID,
    comment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = get_current_user(request)

    comment = await get_comment(db, comment_id)
    if not comment or comment.doubt_id != doubt_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if user.user_type == UserType.student and str(comment.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    # Gather participants before deleting the comment
    doubt_obj_result = await db.execute(select(DoubtModel).where(DoubtModel.id == doubt_id))
    doubt_obj = doubt_obj_result.scalar_one_or_none()

    participant_result = await db.execute(
        select(DoubtCommentModel.user_id)
        .where(DoubtCommentModel.doubt_id == doubt_id)
        .distinct()
    )
    participant_ids = {str(uid) for uid in participant_result.scalars().all()}
    if doubt_obj:
        participant_ids.add(str(doubt_obj.student_id))
    participant_ids.discard(str(user.id))

    await delete_comment(db, comment)

    # Notify participants about the deleted comment
    if participant_ids:
        await manager.send_to_users(
            list(participant_ids),
            {
                "type": "doubt_comment:deleted",
                "payload": {"doubt_id": str(doubt_id), "comment_id": str(comment_id)},
            },
        )

        doubt_title = doubt_obj.title if doubt_obj else "a doubt"
        for pid in participant_ids:
            await create_and_notify(
                db,
                recipient_id=uuid.UUID(pid),
                sender_id=user.id,
                message=f"{user.name} deleted a comment on '{doubt_title}'",
                notification_type="doubt_comment_deleted",
                reference_id=doubt_id,
            )


# ============================================================================
# BOOK-LINKED DOUBTS
# ============================================================================

@router.get("/api/books/{book_id}/doubts", response_model=PaginatedResponse[DoubtOut])
async def list_book_doubts(
    book_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    get_current_user(request)

    items, total, pg, ps, total_pages = await list_doubts(
        db, page=page, page_size=page_size, book_id=book_id,
    )

    return PaginatedResponse(
        items=[DoubtOut(**item) for item in items],
        total=total, page=pg, page_size=ps, total_pages=total_pages,
    )
