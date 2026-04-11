import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.lookup import Section, Standard
from app.models.user import User, UserType


# ---------------------------------------------------------------------------
# Validation helpers (replace hardcoded VALID_STANDARDS)
# ---------------------------------------------------------------------------

async def validate_standard(db: AsyncSession, value: str | None) -> str | None:
    if value is None:
        return None
    result = await db.execute(select(Standard).where(Standard.name == value))
    if result.scalar_one_or_none() is None:
        raise ValueError(f"Invalid standard '{value}'. It does not exist in the system.")
    return value


async def validate_section(db: AsyncSession, value: str | None) -> str | None:
    if value is None:
        return None
    upper = value.strip().upper()
    result = await db.execute(select(Section).where(Section.name == upper))
    if result.scalar_one_or_none() is None:
        raise ValueError(f"Invalid section '{upper}'. It does not exist in the system.")
    return upper


# ---------------------------------------------------------------------------
# Lightweight lookup for dropdown population
# ---------------------------------------------------------------------------

def _standard_label(name: str) -> str:
    n = int(name) if name.isdigit() else 0
    if n == 1:
        return "1st"
    if n == 2:
        return "2nd"
    if n == 3:
        return "3rd"
    if n > 0:
        return f"{n}th"
    return name


async def get_lookup_options(db: AsyncSession) -> dict:
    std_result = await db.execute(select(Standard).order_by(Standard.display_order))
    standards = std_result.scalars().all()

    sec_result = await db.execute(select(Section).order_by(Section.display_order))
    sections = sec_result.scalars().all()

    return {
        "standards": [{"value": s.name, "label": _standard_label(s.name)} for s in standards],
        "sections": [{"value": s.name, "label": f"Section {s.name}"} for s in sections],
    }


# ---------------------------------------------------------------------------
# Standard CRUD
# ---------------------------------------------------------------------------

async def list_standards(db: AsyncSession) -> list[dict]:
    student_count_sub = (
        select(func.count(User.id))
        .where(User.standard == Standard.name, User.user_type == UserType.student)
        .correlate(Standard)
        .scalar_subquery()
    )
    book_count_sub = (
        select(func.count(Book.id))
        .where(Book.standard == Standard.name)
        .correlate(Standard)
        .scalar_subquery()
    )

    query = (
        select(
            Standard,
            student_count_sub.label("student_count"),
            book_count_sub.label("book_count"),
        )
        .order_by(Standard.display_order)
    )
    results = (await db.execute(query)).all()

    items = []
    for std, sc, bc in results:
        items.append({
            "id": str(std.id),
            "name": std.name,
            "display_order": std.display_order,
            "student_count": sc or 0,
            "book_count": bc or 0,
            "created_at": std.created_at,
            "updated_at": std.updated_at,
        })
    return items


async def create_standard(db: AsyncSession, name: str, display_order: int | None = None) -> Standard:
    existing = await db.execute(select(Standard).where(Standard.name == name))
    if existing.scalar_one_or_none():
        raise ValueError(f"Standard '{name}' already exists")

    if display_order is None:
        max_order = (await db.execute(select(func.max(Standard.display_order)))).scalar() or 0
        display_order = max_order + 1

    standard = Standard(name=name, display_order=display_order)
    db.add(standard)
    await db.commit()
    await db.refresh(standard)
    return standard


async def get_standard(db: AsyncSession, standard_id: uuid.UUID) -> Standard | None:
    result = await db.execute(select(Standard).where(Standard.id == standard_id))
    return result.scalar_one_or_none()


async def update_standard(db: AsyncSession, standard: Standard, name: str | None = None, display_order: int | None = None) -> Standard:
    if name is not None and name != standard.name:
        # Block rename if students or books reference the old name
        student_count = (await db.execute(
            select(func.count(User.id)).where(User.standard == standard.name, User.user_type == UserType.student)
        )).scalar() or 0
        book_count = (await db.execute(
            select(func.count(Book.id)).where(Book.standard == standard.name)
        )).scalar() or 0
        if student_count > 0 or book_count > 0:
            raise ValueError(f"Cannot rename standard '{standard.name}': it is in use by students or books")

        # Check uniqueness
        existing = await db.execute(select(Standard).where(Standard.name == name, Standard.id != standard.id))
        if existing.scalar_one_or_none():
            raise ValueError(f"Standard '{name}' already exists")
        standard.name = name

    if display_order is not None:
        standard.display_order = display_order

    await db.commit()
    await db.refresh(standard)
    return standard


async def reorder_standards(db: AsyncSession, ids: list[str]) -> None:
    for idx, id_str in enumerate(ids):
        uid = uuid.UUID(id_str)
        result = await db.execute(select(Standard).where(Standard.id == uid))
        std = result.scalar_one_or_none()
        if std:
            std.display_order = idx + 1
    await db.commit()


async def delete_standard(db: AsyncSession, standard: Standard) -> None:
    student_count = (await db.execute(
        select(func.count(User.id)).where(User.standard == standard.name, User.user_type == UserType.student)
    )).scalar() or 0

    book_count = (await db.execute(
        select(func.count(Book.id)).where(Book.standard == standard.name)
    )).scalar() or 0

    if student_count > 0 or book_count > 0:
        parts = []
        if student_count > 0:
            parts.append(f"{student_count} student{'s' if student_count != 1 else ''}")
        if book_count > 0:
            parts.append(f"{book_count} book{'s' if book_count != 1 else ''}")
        raise ValueError(f"Cannot delete standard '{standard.name}': {' and '.join(parts)} are using it")

    await db.delete(standard)
    await db.commit()


# ---------------------------------------------------------------------------
# Section CRUD
# ---------------------------------------------------------------------------

async def list_sections(db: AsyncSession) -> list[dict]:
    student_count_sub = (
        select(func.count(User.id))
        .where(User.section == Section.name, User.user_type == UserType.student)
        .correlate(Section)
        .scalar_subquery()
    )

    query = (
        select(Section, student_count_sub.label("student_count"))
        .order_by(Section.display_order)
    )
    results = (await db.execute(query)).all()

    items = []
    for sec, sc in results:
        items.append({
            "id": str(sec.id),
            "name": sec.name,
            "display_order": sec.display_order,
            "student_count": sc or 0,
            "created_at": sec.created_at,
            "updated_at": sec.updated_at,
        })
    return items


async def create_section(db: AsyncSession, name: str, display_order: int | None = None) -> Section:
    upper_name = name.strip().upper()
    existing = await db.execute(select(Section).where(Section.name == upper_name))
    if existing.scalar_one_or_none():
        raise ValueError(f"Section '{upper_name}' already exists")

    if display_order is None:
        max_order = (await db.execute(select(func.max(Section.display_order)))).scalar() or 0
        display_order = max_order + 1

    section = Section(name=upper_name, display_order=display_order)
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


async def get_section(db: AsyncSession, section_id: uuid.UUID) -> Section | None:
    result = await db.execute(select(Section).where(Section.id == section_id))
    return result.scalar_one_or_none()


async def update_section(db: AsyncSession, section: Section, name: str | None = None, display_order: int | None = None) -> Section:
    if name is not None and name.strip().upper() != section.name:
        # Block rename if students reference the old name
        student_count = (await db.execute(
            select(func.count(User.id)).where(User.section == section.name, User.user_type == UserType.student)
        )).scalar() or 0
        if student_count > 0:
            raise ValueError(f"Cannot rename section '{section.name}': it is in use by students")

        upper_name = name.strip().upper()
        existing = await db.execute(select(Section).where(Section.name == upper_name, Section.id != section.id))
        if existing.scalar_one_or_none():
            raise ValueError(f"Section '{upper_name}' already exists")
        section.name = upper_name

    if display_order is not None:
        section.display_order = display_order

    await db.commit()
    await db.refresh(section)
    return section


async def reorder_sections(db: AsyncSession, ids: list[str]) -> None:
    for idx, id_str in enumerate(ids):
        uid = uuid.UUID(id_str)
        result = await db.execute(select(Section).where(Section.id == uid))
        sec = result.scalar_one_or_none()
        if sec:
            sec.display_order = idx + 1
    await db.commit()


async def delete_section(db: AsyncSession, section: Section) -> None:
    student_count = (await db.execute(
        select(func.count(User.id)).where(User.section == section.name, User.user_type == UserType.student)
    )).scalar() or 0

    if student_count > 0:
        raise ValueError(f"Cannot delete section '{section.name}': {student_count} student{'s' if student_count != 1 else ''} are using it")

    await db.delete(section)
    await db.commit()
