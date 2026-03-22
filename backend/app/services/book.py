import math
import os
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.user import VALID_STANDARDS, User, UserType
from app.models.watch_progress import WatchProgress

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
ALLOWED_THUMBNAIL_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def validate_video_file(filename: str, size: int) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError(f"Invalid video format. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}")
    max_bytes = settings.MAX_VIDEO_SIZE_MB * 1024 * 1024
    if size > max_bytes:
        raise ValueError(f"Video exceeds {settings.MAX_VIDEO_SIZE_MB}MB limit")
    return ext


def validate_thumbnail_file(filename: str, size: int) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_THUMBNAIL_EXTENSIONS:
        raise ValueError(f"Invalid thumbnail format. Allowed: {', '.join(ALLOWED_THUMBNAIL_EXTENSIONS)}")
    max_bytes = settings.MAX_THUMBNAIL_SIZE_MB * 1024 * 1024
    if size > max_bytes:
        raise ValueError(f"Thumbnail exceeds {settings.MAX_THUMBNAIL_SIZE_MB}MB limit")
    return ext


async def save_upload(content: bytes, directory: str, ext: str) -> str:
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, directory, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(content)
    return f"/uploads/{directory}/{filename}"


def delete_file(url: str) -> None:
    if not url:
        return
    # url is like /uploads/videos/xxx.mp4
    filepath = os.path.join(settings.UPLOAD_DIR, url.replace("/uploads/", "", 1))
    if os.path.exists(filepath):
        os.remove(filepath)


async def create_book(
    db: AsyncSession,
    title: str,
    subject_id: uuid.UUID,
    video_url: str,
    standard: str,
    description: str | None = None,
    thumbnail_url: str | None = None,
    video_duration_seconds: float | None = None,
    sort_order: int = 0,
) -> Book:
    if standard not in VALID_STANDARDS:
        raise ValueError(f"Invalid standard '{standard}'")
    book = Book(
        title=title,
        description=description,
        thumbnail_url=thumbnail_url,
        video_url=video_url,
        video_duration_seconds=video_duration_seconds,
        standard=standard,
        sort_order=sort_order,
        subject_id=subject_id,
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return book


async def get_book(db: AsyncSession, book_id: uuid.UUID) -> Book | None:
    result = await db.execute(select(Book).where(Book.id == book_id))
    return result.scalar_one_or_none()


async def update_book(
    db: AsyncSession,
    book: Book,
    title: str | None = None,
    description: str | None = None,
    standard: str | None = None,
    sort_order: int | None = None,
    video_url: str | None = None,
    thumbnail_url: str | None = None,
    video_duration_seconds: float | None = None,
) -> Book:
    if title is not None:
        book.title = title
    if description is not None:
        book.description = description
    if standard is not None:
        if standard not in VALID_STANDARDS:
            raise ValueError(f"Invalid standard '{standard}'")
        book.standard = standard
    if sort_order is not None:
        book.sort_order = sort_order
    if video_url is not None:
        # Delete old video
        delete_file(book.video_url)
        book.video_url = video_url
    if thumbnail_url is not None:
        # Delete old thumbnail
        if book.thumbnail_url:
            delete_file(book.thumbnail_url)
        book.thumbnail_url = thumbnail_url
    if video_duration_seconds is not None:
        book.video_duration_seconds = video_duration_seconds
    await db.commit()
    await db.refresh(book)
    return book


async def delete_book(db: AsyncSession, book: Book) -> None:
    delete_file(book.video_url)
    if book.thumbnail_url:
        delete_file(book.thumbnail_url)
    await db.delete(book)
    await db.commit()


async def list_books(
    db: AsyncSession,
    subject_id: uuid.UUID,
    user: User,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "sort_order",
    sort_order: str = "asc",
    standard: str | None = None,
) -> tuple[list[dict], int, int, int, int]:
    if user.user_type == UserType.tutor:
        query = select(Book).where(Book.subject_id == subject_id)
    else:
        # Student: only assigned books
        query = (
            select(Book)
            .join(BookAssignment, BookAssignment.book_id == Book.id)
            .where(Book.subject_id == subject_id, BookAssignment.student_id == user.id)
        )

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(Book.title.ilike(search_term), Book.description.ilike(search_term))
        )

    if standard:
        query = query.where(Book.standard == standard)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    allowed_sort = {"sort_order", "title", "standard", "created_at"}
    if sort_by not in allowed_sort:
        sort_by = "sort_order"
    sort_col = getattr(Book, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    books = list(result.scalars().all())

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    # For students, attach watch progress
    items = []
    for book in books:
        item = {"book": book, "progress": None}
        if user.user_type == UserType.student:
            wp_result = await db.execute(
                select(WatchProgress).where(
                    WatchProgress.student_id == user.id,
                    WatchProgress.book_id == book.id,
                )
            )
            item["progress"] = wp_result.scalar_one_or_none()
        items.append(item)

    return items, total, page, page_size, total_pages
