from datetime import datetime

from pydantic import BaseModel, field_validator


class QuestionCreate(BaseModel):
    question_text: str
    question_image_url: str | None = None
    option_a: str
    option_a_image_url: str | None = None
    option_b: str
    option_b_image_url: str | None = None
    option_c: str
    option_c_image_url: str | None = None
    option_d: str
    option_d_image_url: str | None = None
    correct_option: str
    explanation: str | None = None
    time_limit_seconds: int = 60

    @field_validator("correct_option")
    @classmethod
    def validate_correct_option(cls, v: str) -> str:
        v = v.upper()
        if v not in ("A", "B", "C", "D"):
            raise ValueError("correct_option must be A, B, C, or D")
        return v


class QuestionBulkCreate(BaseModel):
    questions: list[QuestionCreate]


class QuestionUpdate(BaseModel):
    question_text: str | None = None
    question_image_url: str | None = None
    option_a: str | None = None
    option_a_image_url: str | None = None
    option_b: str | None = None
    option_b_image_url: str | None = None
    option_c: str | None = None
    option_c_image_url: str | None = None
    option_d: str | None = None
    option_d_image_url: str | None = None
    correct_option: str | None = None
    explanation: str | None = None
    time_limit_seconds: int | None = None

    @field_validator("correct_option")
    @classmethod
    def validate_correct_option(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in ("A", "B", "C", "D"):
            raise ValueError("correct_option must be A, B, C, or D")
        return v


class ReorderRequest(BaseModel):
    question_ids: list[str]


# --- Response schemas ---


class QuestionOut(BaseModel):
    id: str
    book_id: str | None = None
    quiz_set_id: str | None = None
    question_text: str
    question_image_url: str | None = None
    option_a: str
    option_a_image_url: str | None = None
    option_b: str
    option_b_image_url: str | None = None
    option_c: str
    option_c_image_url: str | None = None
    option_d: str
    option_d_image_url: str | None = None
    correct_option: str
    explanation: str | None = None
    time_limit_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentQuestionOut(BaseModel):
    """Question without correct_option — for student quiz view."""
    id: str
    question_text: str
    question_image_url: str | None = None
    option_a: str
    option_a_image_url: str | None = None
    option_b: str
    option_b_image_url: str | None = None
    option_c: str
    option_c_image_url: str | None = None
    option_d: str
    option_d_image_url: str | None = None
    time_limit_seconds: int

    model_config = {"from_attributes": True}


class QuizProgressOut(BaseModel):
    correct_count: int
    skipped_count: int = 0
    total_attempted: int
    total_questions: int = 0
    current_question_index: int = 0
    is_started: bool = False
    is_completed: bool
    started_at: datetime | None = None
    completed_at: datetime | None = None
    score_percentage: float
    total_time_seconds: int

    model_config = {"from_attributes": True}


class ReviewQuestionOut(BaseModel):
    """Question with correct answer + student's answer — for completed quiz review."""
    id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str | None = None
    selected_option: str | None = None  # what the student picked
    is_correct: bool = False

    model_config = {"from_attributes": True}


class QuizSessionOut(BaseModel):
    questions: list[StudentQuestionOut]
    total_questions: int
    total_time_seconds: int
    progress: QuizProgressOut | None = None
    answers: dict[str, str] = {}  # {question_id: selected_option}
    skipped: dict[str, bool] = {}  # {question_id: True} for skipped questions
    review: list[ReviewQuestionOut] | None = None  # only when completed


class QuizSubmitRequest(BaseModel):
    question_id: str
    selected_option: str | None = None
    is_skipped: bool = False
    time_taken_seconds: int | None = None

    @field_validator("selected_option")
    @classmethod
    def validate_selected_option(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in ("A", "B", "C", "D"):
            raise ValueError("selected_option must be A, B, C, or D")
        return v


class QuizSubmitResponse(BaseModel):
    is_correct: bool
    is_skipped: bool = False
    correct_option: str
    explanation: str | None = None
    progress: QuizProgressOut
