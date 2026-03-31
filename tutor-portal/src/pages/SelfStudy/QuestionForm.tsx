import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner, Toast, useToast, MathText, Button } from "@shared";
import api from "../../api/client";

export default function QuestionForm() {
  const params = useParams<{ id: string; bookId: string; quizSetId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Edit mode: /self-study/questions/:id/edit
  // Create mode: /self-study/books/:bookId/questions/new OR /quiz-sets/:quizSetId/questions/new
  const isEdit = !!params.id && !params.bookId && !params.quizSetId;
  const questionId = params.id;
  const isQuizSetMode = !!params.quizSetId;

  const [bookId, setBookId] = useState(params.bookId || searchParams.get("book_id") || "");
  const [quizSetId, setQuizSetId] = useState(params.quizSetId || searchParams.get("quiz_set_id") || "");
  const [sourceTitle, setSourceTitle] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState("A");
  const [explanation, setExplanation] = useState("");
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(60);
  const [questionImageUrl, setQuestionImageUrl] = useState("");
  const [optionAImageUrl, setOptionAImageUrl] = useState("");
  const [optionBImageUrl, setOptionBImageUrl] = useState("");
  const [optionCImageUrl, setOptionCImageUrl] = useState("");
  const [optionDImageUrl, setOptionDImageUrl] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImageFields, setShowImageFields] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    if (isEdit && questionId) {
      api
        .get(`/questions/${questionId}`)
        .then((res) => {
          const q = res.data;
          if (q.book_id) {
            setBookId(q.book_id);
          } else if (q.quiz_set_id) {
            setQuizSetId(q.quiz_set_id);
          }
          setQuestionText(q.question_text);
          setOptionA(q.option_a);
          setOptionB(q.option_b);
          setOptionC(q.option_c);
          setOptionD(q.option_d);
          setCorrectOption(q.correct_option);
          setExplanation(q.explanation || "");
          setTimeLimitSeconds(q.time_limit_seconds);
          setQuestionImageUrl(q.question_image_url || "");
          setOptionAImageUrl(q.option_a_image_url || "");
          setOptionBImageUrl(q.option_b_image_url || "");
          setOptionCImageUrl(q.option_c_image_url || "");
          setOptionDImageUrl(q.option_d_image_url || "");
          if (q.question_image_url || q.option_a_image_url || q.option_b_image_url || q.option_c_image_url || q.option_d_image_url) {
            setShowImageFields(true);
          }
        })
        .catch((err) => {
          showApiError(err, "Failed to load question.");
          navigate("/self-study");
        })
        .finally(() => setLoading(false));
    }
  }, [questionId, isEdit, navigate]);

  // Fetch book or quiz set title for header
  useEffect(() => {
    if (bookId) {
      api
        .get(`/books/${bookId}`)
        .then((res) => setSourceTitle(res.data.title))
        .catch(() => {});
    } else if (quizSetId) {
      api
        .get(`/quiz-sets/${quizSetId}`)
        .then((res) => setSourceTitle(res.data.name))
        .catch(() => {});
    }
  }, [bookId, quizSetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      question_text: questionText,
      question_image_url: questionImageUrl || null,
      option_a: optionA,
      option_a_image_url: optionAImageUrl || null,
      option_b: optionB,
      option_b_image_url: optionBImageUrl || null,
      option_c: optionC,
      option_c_image_url: optionCImageUrl || null,
      option_d: optionD,
      option_d_image_url: optionDImageUrl || null,
      correct_option: correctOption,
      explanation: explanation || null,
      time_limit_seconds: timeLimitSeconds,
    };

    try {
      if (isEdit) {
        await api.put(`/questions/${questionId}`, payload);
      } else if (isQuizSetMode) {
        await api.post(`/quiz-sets/${quizSetId}/questions`, payload);
      } else {
        await api.post(`/books/${bookId}/questions`, payload);
      }
      const redirectPath = isQuizSetMode
        ? `/quiz-sets/${quizSetId}/questions`
        : `/self-study/books/${bookId}/questions`;
      navigate(redirectPath);
    } catch (err: unknown) {
      showApiError(err, "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => {
          const path = isQuizSetMode
            ? `/quiz-sets/${quizSetId}/questions`
            : `/self-study/books/${bookId}/questions`;
          navigate(path);
        }}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Questions
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">
          {isEdit ? "Edit Question" : "Add Question"}
          {sourceTitle && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              — {sourceTitle}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          {showPreview ? "Hide Preview" : "Show Preview"}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
      >
        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Text *
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
            rows={3}
            placeholder="Supports LaTeX: $E = mc^2$ for inline, $$\frac{1}{2}$$ for block"
            className={`${inputClass} resize-none`}
          />
          {showPreview && questionText && (
            <div className="mt-1 p-2 bg-gray-50 rounded text-sm border border-gray-200">
              <MathText text={questionText} />
            </div>
          )}
        </div>

        {/* Question Image URL */}
        <div>
          <button
            type="button"
            onClick={() => setShowImageFields(!showImageFields)}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <svg className={`w-4 h-4 transition-transform ${showImageFields ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showImageFields ? "Hide Image Fields" : "Add Images (optional)"}
          </button>
        </div>

        {showImageFields && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-xs text-gray-500">Paste Google Drive image URLs or any direct image URL.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Question Image URL</label>
              <input
                type="url"
                value={questionImageUrl}
                onChange={(e) => setQuestionImageUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Options */}
        {[
          { label: "Option A *", value: optionA, setter: setOptionA, imgValue: optionAImageUrl, imgSetter: setOptionAImageUrl },
          { label: "Option B *", value: optionB, setter: setOptionB, imgValue: optionBImageUrl, imgSetter: setOptionBImageUrl },
          { label: "Option C *", value: optionC, setter: setOptionC, imgValue: optionCImageUrl, imgSetter: setOptionCImageUrl },
          { label: "Option D *", value: optionD, setter: setOptionD, imgValue: optionDImageUrl, imgSetter: setOptionDImageUrl },
        ].map(({ label, value, setter, imgValue, imgSetter }) => (
          <div key={label}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setter(e.target.value)}
              required
              placeholder="Supports LaTeX: $\phi = BA$"
              className={inputClass}
            />
            {showPreview && value && (
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm border border-gray-200">
                <MathText text={value} />
              </div>
            )}
            {showImageFields && (
              <div className="mt-1">
                <input
                  type="url"
                  value={imgValue}
                  onChange={(e) => imgSetter(e.target.value)}
                  placeholder="Image URL for this option (optional)"
                  className={`${inputClass} text-xs`}
                />
              </div>
            )}
          </div>
        ))}

        {/* Correct Option */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correct Answer *
          </label>
          <div className="flex gap-4">
            {["A", "B", "C", "D"].map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  correctOption === opt
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="correct_option"
                  value={opt}
                  checked={correctOption === opt}
                  onChange={() => setCorrectOption(opt)}
                  className="sr-only"
                />
                <span className="font-medium">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Explanation (shown after answering)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
          {showPreview && explanation && (
            <div className="mt-1 p-2 bg-gray-50 rounded text-sm border border-gray-200">
              <MathText text={explanation} />
            </div>
          )}
        </div>

        {/* Time Limit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Time Limit (seconds)
          </label>
          <input
            type="number"
            value={timeLimitSeconds}
            onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
            min={10}
            max={300}
            className={inputClass}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button" variant="outline" color="secondary" fullWidth
            onClick={() => {
              const path = isQuizSetMode
                ? `/quiz-sets/${quizSetId}/questions`
                : `/self-study/books/${bookId}/questions`;
              navigate(path);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" color={isEdit ? "primary" : "success"} fullWidth disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Question" : "Create Question"}
          </Button>
        </div>
      </form>
    </div>
  );
}
