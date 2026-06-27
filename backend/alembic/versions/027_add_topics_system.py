"""add topics system

Revision ID: 027
Revises: 026
Create Date: 2026-06-27 00:00:00.000000

Replaces book-level video/quiz/recap with per-topic content.
Each Book now contains ordered Topics. Quiz, watch progress, and
notes are scoped to topics. Book retains test and doubts.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None

_audit_cols = [
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    sa.Column("created_by", sa.String(), nullable=True),
    sa.Column("updated_by", sa.String(), nullable=True),
    sa.Column("created_by_name", sa.String(), nullable=True),
    sa.Column("updated_by_name", sa.String(), nullable=True),
]


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create topics table
    # ------------------------------------------------------------------
    op.create_table(
        "topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        *_audit_cols,
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_topics_book_id", "topics", ["book_id"])
    op.create_index("ix_topics_book_position", "topics", ["book_id", "position"])

    # ------------------------------------------------------------------
    # 2. Create topic_notes table
    # ------------------------------------------------------------------
    op.create_table(
        "topic_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSON(), nullable=False, server_default="{}"),
        *_audit_cols,
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("topic_id", name="uq_topic_notes_topic_id"),
    )
    op.create_index("ix_topic_notes_topic_id", "topic_notes", ["topic_id"])
    op.create_index("ix_topic_notes_author_id", "topic_notes", ["author_id"])

    # ------------------------------------------------------------------
    # 3. Drop book_recaps table
    # ------------------------------------------------------------------
    op.drop_index("ix_book_recaps_author_id", table_name="book_recaps")
    op.drop_index("ix_book_recaps_book_id", table_name="book_recaps")
    op.drop_table("book_recaps")

    # ------------------------------------------------------------------
    # 4. Remove video_url from books
    # ------------------------------------------------------------------
    op.drop_column("books", "video_url")

    # ------------------------------------------------------------------
    # 5. Update questions table: book_id -> topic_id
    # ------------------------------------------------------------------
    # Drop old constraint and index on book_id
    op.drop_constraint("ck_question_source_check", "questions", type_="check")
    op.drop_index("ix_questions_book_id", table_name="questions")

    # Drop the book_id column
    op.drop_column("questions", "book_id")

    # Add topic_id column
    op.add_column(
        "questions",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_questions_topic_id",
        "questions", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_questions_topic_id", "questions", ["topic_id"])

    # Add new XOR constraint: exactly one of topic_id or quiz_set_id
    op.create_check_constraint(
        "ck_question_source_check",
        "questions",
        "NOT (topic_id IS NULL AND quiz_set_id IS NULL) AND "
        "NOT (topic_id IS NOT NULL AND quiz_set_id IS NOT NULL)",
    )

    # ------------------------------------------------------------------
    # 6. Update watch_progress table: book_id -> topic_id
    # ------------------------------------------------------------------
    op.drop_constraint("uq_student_book_progress", "watch_progress", type_="unique")
    op.drop_index("ix_watch_progress_student_last_watched", table_name="watch_progress")

    # Drop old FK and column
    op.drop_constraint("watch_progress_book_id_fkey", "watch_progress", type_="foreignkey")
    op.drop_column("watch_progress", "book_id")

    # Add topic_id
    op.add_column(
        "watch_progress",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
    )
    # Remove the server_default now that column exists (it was only needed for NOT NULL on existing rows)
    op.alter_column("watch_progress", "topic_id", server_default=None)

    op.create_foreign_key(
        "fk_watch_progress_topic_id",
        "watch_progress", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_student_topic_progress", "watch_progress", ["student_id", "topic_id"])
    op.create_index("ix_watch_progress_student_last_watched", "watch_progress", ["student_id", "last_watched_at"])

    # ------------------------------------------------------------------
    # 7. Update quiz_progress table: book_id -> topic_id
    # ------------------------------------------------------------------
    op.drop_constraint("uq_student_book_quiz", "quiz_progress", type_="unique")
    op.drop_index("ix_quiz_progress_student_book", table_name="quiz_progress")

    op.drop_constraint("quiz_progress_book_id_fkey", "quiz_progress", type_="foreignkey")
    op.drop_column("quiz_progress", "book_id")

    op.add_column(
        "quiz_progress",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quiz_progress_topic_id",
        "quiz_progress", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_student_topic_quiz", "quiz_progress", ["student_id", "topic_id"])
    op.create_index("ix_quiz_progress_student_topic", "quiz_progress", ["student_id", "topic_id"])

    # ------------------------------------------------------------------
    # 8. Update quiz_attempts table: book_id -> topic_id
    # ------------------------------------------------------------------
    op.drop_index("ix_quiz_attempt_student_book", table_name="quiz_attempts")

    op.drop_constraint("quiz_attempts_book_id_fkey", "quiz_attempts", type_="foreignkey")
    op.drop_column("quiz_attempts", "book_id")

    op.add_column(
        "quiz_attempts",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quiz_attempts_topic_id",
        "quiz_attempts", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_quiz_attempt_student_topic", "quiz_attempts", ["student_id", "topic_id"])


def downgrade() -> None:
    # ------------------------------------------------------------------
    # 8. Restore quiz_attempts: topic_id -> book_id
    # ------------------------------------------------------------------
    op.drop_index("ix_quiz_attempt_student_topic", table_name="quiz_attempts")
    op.drop_constraint("fk_quiz_attempts_topic_id", "quiz_attempts", type_="foreignkey")
    op.drop_column("quiz_attempts", "topic_id")
    op.add_column(
        "quiz_attempts",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "quiz_attempts_book_id_fkey",
        "quiz_attempts", "books",
        ["book_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_quiz_attempt_student_book", "quiz_attempts", ["student_id", "book_id"])

    # ------------------------------------------------------------------
    # 7. Restore quiz_progress: topic_id -> book_id
    # ------------------------------------------------------------------
    op.drop_index("ix_quiz_progress_student_topic", table_name="quiz_progress")
    op.drop_constraint("uq_student_topic_quiz", "quiz_progress", type_="unique")
    op.drop_constraint("fk_quiz_progress_topic_id", "quiz_progress", type_="foreignkey")
    op.drop_column("quiz_progress", "topic_id")
    op.add_column(
        "quiz_progress",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "quiz_progress_book_id_fkey",
        "quiz_progress", "books",
        ["book_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_student_book_quiz", "quiz_progress", ["student_id", "book_id"])
    op.create_index("ix_quiz_progress_student_book", "quiz_progress", ["student_id", "book_id"])

    # ------------------------------------------------------------------
    # 6. Restore watch_progress: topic_id -> book_id
    # ------------------------------------------------------------------
    op.drop_index("ix_watch_progress_student_last_watched", table_name="watch_progress")
    op.drop_constraint("uq_student_topic_progress", "watch_progress", type_="unique")
    op.drop_constraint("fk_watch_progress_topic_id", "watch_progress", type_="foreignkey")
    op.drop_column("watch_progress", "topic_id")
    op.add_column(
        "watch_progress",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
    )
    op.alter_column("watch_progress", "book_id", server_default=None)
    op.create_foreign_key(
        "watch_progress_book_id_fkey",
        "watch_progress", "books",
        ["book_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_student_book_progress", "watch_progress", ["student_id", "book_id"])
    op.create_index("ix_watch_progress_student_last_watched", "watch_progress", ["student_id", "last_watched_at"])

    # ------------------------------------------------------------------
    # 5. Restore questions table: topic_id -> book_id
    # ------------------------------------------------------------------
    op.drop_constraint("ck_question_source_check", "questions", type_="check")
    op.drop_index("ix_questions_topic_id", table_name="questions")
    op.drop_constraint("fk_questions_topic_id", "questions", type_="foreignkey")
    op.drop_column("questions", "topic_id")
    op.add_column(
        "questions",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "questions_book_id_fkey",
        "questions", "books",
        ["book_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_questions_book_id", "questions", ["book_id"])
    op.create_check_constraint(
        "ck_question_source_check",
        "questions",
        "NOT (book_id IS NULL AND quiz_set_id IS NULL) AND "
        "NOT (book_id IS NOT NULL AND quiz_set_id IS NOT NULL)",
    )

    # ------------------------------------------------------------------
    # 4. Restore video_url on books
    # ------------------------------------------------------------------
    op.add_column("books", sa.Column("video_url", sa.String(), nullable=True))

    # ------------------------------------------------------------------
    # 3. Restore book_recaps table
    # ------------------------------------------------------------------
    op.create_table(
        "book_recaps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSON(), nullable=False, server_default="{}"),
        *_audit_cols,
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_book_recaps_book_id", "book_recaps", ["book_id"])
    op.create_index("ix_book_recaps_author_id", "book_recaps", ["author_id"])

    # ------------------------------------------------------------------
    # 2. Drop topic_notes table
    # ------------------------------------------------------------------
    op.drop_index("ix_topic_notes_author_id", table_name="topic_notes")
    op.drop_index("ix_topic_notes_topic_id", table_name="topic_notes")
    op.drop_table("topic_notes")

    # ------------------------------------------------------------------
    # 1. Drop topics table
    # ------------------------------------------------------------------
    op.drop_index("ix_topics_book_position", table_name="topics")
    op.drop_index("ix_topics_book_id", table_name="topics")
    op.drop_table("topics")
