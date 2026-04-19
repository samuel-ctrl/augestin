"""Human-readable labels for activity log actions.

Falls back to formatted route-name for any action not explicitly mapped,
so new endpoints still render sensibly in the UI without needing code edits here.
"""

ACTION_LABELS: dict[str, str] = {
    # auth
    "login": "Logged in",
    "login_failed": "Failed login",
    "change_pwd": "Changed password",
    "unauthenticated_request": "Unauthenticated request",

    # students
    "create_student_endpoint": "Created student",
    "update_student_endpoint": "Updated student",
    "delete_student_endpoint": "Deleted student",
    "reset_password_endpoint": "Reset student password",

    # assignments
    "assign_book_endpoint": "Assigned book",
    "delete_assignment_endpoint": "Deleted assignment",

    # subjects
    "create_subject_endpoint": "Created subject",
    "update_subject_endpoint": "Updated subject",
    "delete_subject_endpoint": "Deleted subject",

    # books
    "create_book_endpoint": "Created book",
    "update_book_endpoint": "Updated book",
    "delete_book_endpoint": "Deleted book",

    # questions
    "create_question_endpoint": "Created question",
    "update_question_endpoint": "Updated question",
    "delete_question_endpoint": "Deleted question",
    "bulk_create_questions_endpoint": "Bulk-created questions",

    # quiz sets
    "create_quiz_set": "Created quiz set",
    "update_quiz_set": "Updated quiz set",
    "delete_quiz_set": "Deleted quiz set",

    # test sets
    "create_test_set_endpoint": "Created test set",
    "update_test_set_endpoint": "Updated test set",
    "delete_test_set_endpoint": "Deleted test set",

    # tests (book)
    "create_or_update_book_test": "Created/updated book test",
    "delete_book_test": "Deleted book test",

    # doubts
    "create_doubt_endpoint": "Created doubt",
    "update_doubt_endpoint": "Updated doubt",
    "delete_doubt_endpoint": "Deleted doubt",
    "request_delete_doubt_endpoint": "Requested doubt deletion",
    "update_doubt_status_endpoint": "Updated doubt status",
    "create_comment_endpoint": "Added comment",
    "update_comment_endpoint": "Updated comment",
    "delete_comment_endpoint": "Deleted comment",

    # progress
    "update_progress": "Updated progress",

    # recap
    "create_or_update_recap_endpoint": "Created/updated recap",
    "delete_recap_endpoint": "Deleted recap",

    # quiz submission
    "submit_answer": "Submitted quiz answer",

    # lookups
    "create_standard_endpoint": "Created standard",
    "update_standard_endpoint": "Updated standard",
    "delete_standard_endpoint": "Deleted standard",
    "create_section_endpoint": "Created section",
    "update_section_endpoint": "Updated section",
    "delete_section_endpoint": "Deleted section",

    # settings
    "update_tutor_contact": "Updated tutor contact",
}


def label_for(action: str) -> str:
    if action in ACTION_LABELS:
        return ACTION_LABELS[action]
    base = action.removesuffix("_endpoint").replace("_", " ").strip()
    return base[:1].upper() + base[1:] if base else action
