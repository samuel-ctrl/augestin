-- =============================================================
-- migrate_027_dump_and_seed.sql
-- Run BEFORE migration 027 to capture state, then re-seed after.
-- =============================================================

-- ---------------------------------------------------------------
-- SECTION 1: PRE-MIGRATION DUMP
-- (These SELECTs capture data that 027 will delete/restructure.
--  Run them before `alembic upgrade 027` and save the output.)
-- ---------------------------------------------------------------

-- 1a. Books (survived migration — included for FK reference)
SELECT id, title, standard, subject_id, description, thumbnail_url
FROM books
ORDER BY created_at;

-- 1b. Book-level questions (dropped in 027: book_id -> topic_id)
--     These need to be re-inserted under a topic after seeding.
--     NOTE: book_id column no longer exists post-027; this query is
--     for documentation only (run against a pre-027 DB).
-- SELECT id, book_id, question_text, option_a, option_b, option_c,
--        option_d, correct_option, explanation
-- FROM questions
-- WHERE quiz_set_id IS NULL
-- ORDER BY book_id, created_at;

-- 1c. Watch progress (cleared in 027; book_id -> topic_id)
-- SELECT id, student_id, book_id, watch_percentage, last_watched_at
-- FROM watch_progress
-- ORDER BY student_id, book_id;

-- 1d. Quiz progress (book-level, quiz_source='book'; topic_id was NULL post-027)
-- SELECT id, student_id, quiz_id AS book_id, correct_count,
--        total_attempted, total_questions, is_completed, score_percentage
-- FROM quiz_progress
-- WHERE quiz_source = 'book'
-- ORDER BY student_id;

-- 1e. Quiz attempts (cleared in 027; book_id -> topic_id)
-- SELECT id, student_id, book_id, question_id, selected_option, is_correct
-- FROM quiz_attempts
-- ORDER BY student_id, book_id;


-- ---------------------------------------------------------------
-- SECTION 2: POST-MIGRATION STATE (verify before seeding)
-- ---------------------------------------------------------------

SELECT 'books'          AS tbl, COUNT(*) FROM books
UNION ALL
SELECT 'topics',                COUNT(*) FROM topics
UNION ALL
SELECT 'questions',             COUNT(*) FROM questions
UNION ALL
SELECT 'watch_progress',        COUNT(*) FROM watch_progress
UNION ALL
SELECT 'quiz_progress',         COUNT(*) FROM quiz_progress
UNION ALL
SELECT 'quiz_attempts',         COUNT(*) FROM quiz_attempts;


-- ---------------------------------------------------------------
-- SECTION 3: SEED — create topics from books + reassign data
-- ---------------------------------------------------------------

-- Creates one default topic per book and:
--   - Reassigns any orphaned quiz_progress (quiz_source='book',
--     topic_id IS NULL, quiz_id = the book's ID) to the new topic.
-- Extend this block to add more topics per book as needed.

WITH new_topics AS (
    INSERT INTO topics (
        id, book_id, title, position,
        created_at, version
    )
    SELECT
        gen_random_uuid(),
        b.id,
        'Chapter 1',
        1,
        now(),
        1
    FROM books b
    -- Skip books that already have at least one topic
    WHERE NOT EXISTS (
        SELECT 1 FROM topics t WHERE t.book_id = b.id
    )
    RETURNING id, book_id
),
reassign_quiz_progress AS (
    UPDATE quiz_progress qp
    SET topic_id = nt.id
    FROM new_topics nt
    WHERE qp.quiz_source = 'book'
      AND qp.quiz_id     = nt.book_id
      AND qp.topic_id    IS NULL
    RETURNING qp.id, nt.book_id
)
SELECT
    'topics inserted'     AS action,
    COUNT(*)              AS rows
FROM new_topics
UNION ALL
SELECT
    'quiz_progress reassigned',
    COUNT(*)
FROM reassign_quiz_progress;


-- ---------------------------------------------------------------
-- SECTION 4: VERIFY SEED RESULT
-- ---------------------------------------------------------------

SELECT b.title AS book, t.id AS topic_id, t.title AS topic, t.position
FROM topics t
JOIN books b ON b.id = t.book_id
ORDER BY b.title, t.position;

SELECT qp.id, u.name AS student, b.title AS book,
       qp.topic_id, qp.correct_count, qp.total_attempted,
       qp.is_completed, qp.score_percentage
FROM quiz_progress qp
JOIN users u ON u.id = qp.student_id
LEFT JOIN topics t ON t.id = qp.topic_id
LEFT JOIN books  b ON b.id = t.book_id
ORDER BY qp.created_at;
