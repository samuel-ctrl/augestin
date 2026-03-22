"""
Context variable for tracking the current authenticated user.

Set by AuthMiddleware on each request, read by the audit event listener
to auto-populate created_by / updated_by fields.
"""

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass
class UserContext:
    user_id: str
    name: str


_current_user: ContextVar[UserContext | None] = ContextVar("current_user", default=None)


def set_current_logged_user(user: UserContext | None) -> None:
    _current_user.set(user)


def get_current_logged_user() -> UserContext | None:
    return _current_user.get()
