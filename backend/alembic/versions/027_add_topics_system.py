"""add topics system

Revision ID: 027
Revises: 026
Create Date: 2026-06-27 00:00:00.000000

Replaces book-level video/quiz/recap with per-topic content.
Each Book now contains ordered Topics. Quiz, watch progress, and
notes are scoped to topics. Book retains test and doubts.

Data migration strategy (zero data loss):
  - One default "Chapter 1" topic is created per book, carrying
    the book's existing video_url.
  - book_recaps are migrated to topic_notes on that default topic.
  - questions, watch_progress, quiz_progress, quiz_attempts are all
    remapped to the new topic before their old book_id column is dropped.
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
    # 3. Seed: create one default topic per book, carrying video_url
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO topics (id, book_id, title, position, video_url, created_at, version)
        SELECT gen_random_uuid(), id, 'Chapter 1', 1, video_url, now(), 1
        FROM books
    """)

    # ------------------------------------------------------------------
    # 4. Migrate book_recaps -> topic_notes on the default topic
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO topic_notes (id, topic_id, author_id, title, content, created_at, version)
        SELECT gen_random_uuid(), t.id, br.author_id, br.title, br.content, br.created_at, 1
        FROM book_recaps br
        JOIN topics t ON t.book_id = br.book_id
    """)

    # ------------------------------------------------------------------
    # 5. Drop book_recaps (data now in topic_notes)
    # ------------------------------------------------------------------
    op.drop_index("ix_book_recaps_author_id", table_name="book_recaps")
    op.drop_index("ix_book_recaps_book_id", table_name="book_recaps")
    op.drop_table("book_recaps")

    # ------------------------------------------------------------------
    # 6. Remove video_url from books (carried to topics in step 3)
    # ------------------------------------------------------------------
    op.drop_column("books", "video_url")

    # ------------------------------------------------------------------
    # 7. Update questions table: book_id -> topic_id
    # ------------------------------------------------------------------
    op.drop_constraint("ck_question_source_check", "questions", type_="check")
    op.drop_index("ix_questions_book_id", table_name="questions")

    # Add topic_id before dropping book_id so we can remap in one pass
    op.add_column(
        "questions",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Point each book question to the default topic of its book
    op.execute("""
        UPDATE questions q
        SET topic_id = t.id
        FROM topics t
        WHERE t.book_id = q.book_id
          AND q.quiz_set_id IS NULL
    """)

    # Now safe to drop book_id
    op.drop_column("questions", "book_id")

    # Defensive: remove any questions with no valid parent after remap
    op.execute("DELETE FROM questions WHERE topic_id IS NULL AND quiz_set_id IS NULL")

    op.create_foreign_key(
        "fk_questions_topic_id",
        "questions", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_questions_topic_id", "questions", ["topic_id"])

    # XOR constraint: exactly one of topic_id or quiz_set_id must be set
    op.create_check_constraint(
        "ck_question_source_check",
        "questions",
        "NOT (topic_id IS NULL AND quiz_set_id IS NULL) AND "
        "NOT (topic_id IS NOT NULL AND quiz_set_id IS NOT NULL)",
    )

    # ------------------------------------------------------------------
    # 8. Update watch_progress table: book_id -> topic_id
    # ------------------------------------------------------------------
    # Add topic_id before dropping book_id so we can remap
    op.add_column(
        "watch_progress",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Point each watch record to the default topic of its book
    op.execute("""
        UPDATE watch_progress wp
        SET topic_id = t.id
        FROM topics t
        WHERE t.book_id = wp.book_id
    """)

    # Remove records for books that had no default topic (shouldn't happen)
    op.execute("DELETE FROM watch_progress WHERE topic_id IS NULL")

    op.drop_constraint("uq_student_book_progress", "watch_progress", type_="unique")
    op.drop_index("ix_watch_progress_student_last_watched", table_name="watch_progress")
    op.drop_constraint("watch_progress_book_id_fkey", "watch_progress", type_="foreignkey")
    op.drop_column("watch_progress", "book_id")

    # topic_id is guaranteed non-null now — enforce it
    op.alter_column("watch_progress", "topic_id", nullable=False)

    op.create_foreign_key(
        "fk_watch_progress_topic_id",
        "watch_progress", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_student_topic_progress", "watch_progress", ["student_id", "topic_id"])
    op.create_index("ix_watch_progress_student_last_watched", "watch_progress", ["student_id", "last_watched_at"])

    # ------------------------------------------------------------------
    # 9. Update quiz_progress table: book_id -> topic_id
    # ------------------------------------------------------------------
    op.drop_constraint("uq_student_book_quiz", "quiz_progress", type_="unique")
    op.drop_index("ix_quiz_progress_student_book", table_name="quiz_progress")
    op.drop_constraint("quiz_progress_book_id_fkey", "quiz_progress", type_="foreignkey")

    # Add topic_id before dropping book_id
    op.add_column(
        "quiz_progress",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Remap book-level quiz progress: point to the default topic AND fix quiz_source/quiz_id
    # so the new services (which query quiz_source='topic') can find this progress.
    op.execute("""
        UPDATE quiz_progress qp
        SET topic_id   = t.id,
            quiz_source = 'topic',
            quiz_id     = t.id
        FROM topics t
        WHERE t.book_id = qp.book_id
          AND qp.book_id IS NOT NULL
    """)

    op.drop_column("quiz_progress", "book_id")

    op.create_foreign_key(
        "fk_quiz_progress_topic_id",
        "quiz_progress", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_student_topic_quiz", "quiz_progress", ["student_id", "topic_id"])
    op.create_index("ix_quiz_progress_student_topic", "quiz_progress", ["student_id", "topic_id"])

    # ------------------------------------------------------------------
    # 10. Update quiz_attempts table: book_id -> topic_id
    # ------------------------------------------------------------------
    # Add topic_id before dropping book_id
    op.add_column(
        "quiz_attempts",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Remap each attempt to the default topic of its book
    op.execute("""
        UPDATE quiz_attempts qa
        SET topic_id = t.id
        FROM topics t
        WHERE t.book_id = qa.book_id
    """)

    op.drop_index("ix_quiz_attempt_student_book", table_name="quiz_attempts")
    op.drop_constraint("quiz_attempts_book_id_fkey", "quiz_attempts", type_="foreignkey")
    op.drop_column("quiz_attempts", "book_id")

    op.create_foreign_key(
        "fk_quiz_attempts_topic_id",
        "quiz_attempts", "topics",
        ["topic_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_quiz_attempt_student_topic", "quiz_attempts", ["student_id", "topic_id"])


def downgrade() -> None:
    # ------------------------------------------------------------------
    # 10. Restore quiz_attempts: topic_id -> book_id
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
    # 9. Restore quiz_progress: topic_id -> book_id
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
    # 8. Restore watch_progress: topic_id -> book_id
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
    # 7. Restore questions table: topic_id -> book_id
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
    # 6. Restore video_url on books
    # ------------------------------------------------------------------
    op.add_column("books", sa.Column("video_url", sa.String(), nullable=True))

    # ------------------------------------------------------------------
    # 5. Restore book_recaps table (schema only — data not restored)
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
