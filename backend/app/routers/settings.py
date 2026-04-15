from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_tutor
from app.models.app_setting import AppSetting
from app.schemas.settings import TutorContactOut, TutorContactUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

TUTOR_CONTACT_EMAIL_KEY = "tutor_contact_email"
TUTOR_CONTACT_WHATSAPP_KEY = "tutor_contact_whatsapp"


async def _get_setting(db: AsyncSession, key: str) -> str | None:
    res = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = res.scalar_one_or_none()
    return row.value if row else None


async def _set_setting(db: AsyncSession, key: str, value: str | None, updated_by: str) -> None:
    res = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = res.scalar_one_or_none()
    if row is None:
        row = AppSetting(key=key, value=value, updated_by=updated_by)
        db.add(row)
    else:
        row.value = value
        row.updated_by = updated_by


@router.get("/tutor-contact", response_model=TutorContactOut)
async def get_tutor_contact(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    get_current_user(request)
    email = await _get_setting(db, TUTOR_CONTACT_EMAIL_KEY)
    whatsapp = await _get_setting(db, TUTOR_CONTACT_WHATSAPP_KEY)
    return TutorContactOut(email=email, whatsapp=whatsapp)


@router.put("/tutor-contact", response_model=TutorContactOut)
async def update_tutor_contact(
    body: TutorContactUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tutor = require_tutor(request)
    email = (body.email or "").strip() or None
    whatsapp = (body.whatsapp or "").strip() or None
    await _set_setting(db, TUTOR_CONTACT_EMAIL_KEY, email, str(tutor.id))
    await _set_setting(db, TUTOR_CONTACT_WHATSAPP_KEY, whatsapp, str(tutor.id))
    await db.commit()
    return TutorContactOut(email=email, whatsapp=whatsapp)
