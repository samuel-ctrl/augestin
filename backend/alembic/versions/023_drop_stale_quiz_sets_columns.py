"""drop stale subject_id and sort_order columns from quiz_sets

Some deployments applied an earlier version of migration 009 that created
quiz_sets with subject_id (NOT NULL) and sort_order columns. The current
model/router doesn't use them, so inserts fail with NotNullViolationError
on subject_id. Drop them if they exist.

Revision ID: 023
Revises: 022
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op


revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use IF EXISTS so this is a no-op on environments where migration 009
    # created quiz_sets without these columns.
    op.execute("ALTER TABLE quiz_sets DROP COLUMN IF EXISTS subject_id")
    op.execute("ALTER TABLE quiz_sets DROP COLUMN IF EXISTS sort_order")


def downgrade() -> None:
    # No-op: we can't reconstruct the dropped data, and these columns are
    # not used by the application.
    pass
