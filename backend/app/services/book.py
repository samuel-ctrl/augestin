import math
import socket
import uuid
from ipaddress import ip_address
from urllib.parse import unquote, urlparse

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_assignment import BookAssignment
from app.models.user import User, UserType
from app.services.lookup import validate_standard


def validate_url(url: str) -> str:
    """Validate that the URL is a safe HTTPS/HTTP URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Invalid URL")

    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"URL scheme '{parsed.scheme}' is not allowed. Use http or https.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must have a valid hostname")

    # Decode percent-encoded hostnames before checking
    decoded_hostname = unquote(hostname)

    # Block private/internal IPs (check both raw and decoded hostname)
    for name in (hostname, decoded_hostname):
        try:
            addr = ip_address(name)
            if addr.is_private or addr.is_loopback or addr.is_reserved:
                raise ValueError("URLs pointing to private or internal addresses are not allowed")
        except ValueError as e:
            if "not allowed" in str(e):
                raise
            # Not an IP address — that's fine, it's a domain name

    # Resolve hostname and block private IPs behind DNS
    try:
        resolved = socket.getaddrinfo(decoded_hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for family, _, _, _, sockaddr in resolved:
            addr = ip_address(sockaddr[0])
            if addr.is_private or addr.is_loopback or addr.is_reserved:
                raise ValueError("URLs pointing to private or internal addresses are not allowed")
    except socket.gaierror:
        # Cannot resolve — allow it (may be valid but not resolvable from this host)
        pass

    return url


async def create_book(
    db: AsyncSession,
    title: str,
    subject_id: uuid.UUID,
    video_url: str,
    standard: str,
    description: str | None = None,
    thumbnail_url: str | None = None,
) -> Book:
    await validate_standard(db, standard)
    validate_url(video_url)
    if thumbnail_url:
        validate_url(thumbnail_url)
    book = Book(
        title=title,
        description=description,
        thumbnail_url=thumbnail_url,
        video_url=video_url,
        standard=standard,
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
    video_url: str | None = None,
    thumbnail_url: str | None = None,
) -> Book:
    if title is not None:
        book.title = title
    if description is not None:
        book.description = description
    if standard is not None:
        await validate_standard(db, standard)
        book.standard = standard
    if video_url is not None:
        validate_url(video_url)
        book.video_url = video_url
    if thumbnail_url is not None:
        if thumbnail_url == "":
            book.thumbnail_url = None  # clear thumbnail
        else:
            validate_url(thumbnail_url)
            book.thumbnail_url = thumbnail_url
    await db.commit()
    await db.refresh(book)
    return book


async def delete_book(db: AsyncSession, book: Book) -> None:
    await db.delete(book)
    await db.commit()


async def list_books(
    db: AsyncSession,
    subject_id: uuid.UUID,
    user: User,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "created_at",
    sort_order: str = "asc",
    standard: str | None = None,
) -> tuple[list[Book], int, int, int, int]:
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
    allowed_sort = {"title", "standard", "created_at"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    sort_col = getattr(Book, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    query = query.order_by(order)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    books = list(result.scalars().all())

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return books, total, page, page_size, total_pages
