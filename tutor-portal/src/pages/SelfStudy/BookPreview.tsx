import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { VideoPlayer, LoadingSpinner, EmptyState, MathText, RecapViewer, extractErrorMessage } from "@shared";
import type { Book, Subject, Question } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

type Tab = "record" | "quiz" | "recap" | "test";

export default function BookPreview() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("record");
  const [recap, setRecap] = useState<any | null>(null);
  const [test, setTest] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const bookRes = await api.get(`/books/${bookId}`);
      const bookData = bookRes.data;
      setBook(bookData);

      const [subjectRes, questionsRes, recapRes, testRes] = await Promise.all([
        api.get(`/subjects/${bookData.subject_id}`),
        api.get(`/books/${bookId}/questions`, {
          params: { page: 1, page_size: 100, sort_by: "created_at", sort_order: "asc" },
        }),
        api.get(`/books/${bookId}/recap`).catch(() => ({ data: null })),
        api.get(`/books/${bookId}/test`).catch(() => ({ data: null })),
      ]);
      setSubject(subjectRes.data);
      setQuestions(questionsRes.data.items);
      setRecap(recapRes.data);
      setTest(testRes.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/self-study");
      } else {
        setError(extractErrorMessage(err, "Failed to load book."));
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setError(null); setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!book || !subject) return null;

  const hasQuestions = questions.length > 0;

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/self-study/subjects/${subject.id}`)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
        >
          &larr; Back to {subject.name}
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-800">{book.title}</h1>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
            Student Preview
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("record")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            activeTab === "record"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Record
        </button>
        {hasQuestions ? (
          <button
            onClick={() => setActiveTab("quiz")}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "quiz"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Quiz
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === "quiz"
                ? "bg-white/20 text-white"
                : "bg-primary-100 text-primary-600"
            }`}>
              {questions.length}
            </span>
          </button>
        ) : (
          <button
            className="px-4 py-2 text-sm rounded-lg font-medium bg-gray-100 text-gray-400 cursor-not-allowed flex items-center gap-1"
            disabled
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Quiz
          </button>
        )}
        <button
          onClick={() => setActiveTab("recap")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "recap"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Recap
          {recap && (
            <span className={`w-2 h-2 rounded-full ${
              activeTab === "recap" ? "bg-white/60" : "bg-green-500"
            }`}></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("test")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "test"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Test
          {test && (
            <span className={`w-2 h-2 rounded-full ${
              activeTab === "test" ? "bg-white/60" : "bg-green-500"
            }`}></span>
          )}
        </button>
      </div>

      {activeTab === "record" && (
        <div>
          <VideoPlayer src={assetUrl(book.video_url)} />
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-800">{book.title}</h2>
            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
              Standard: {book.standard}th
            </span>
            {book.description && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{book.description}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "quiz" && (
        <QuizPreview questions={questions} />
      )}

      {activeTab === "recap" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recap</h2>
            <button
              onClick={() => navigate(`/self-study/books/${bookId}/recap`)}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
            >
              {recap ? "Edit Recap" : "Create Recap"}
            </button>
          </div>
          {recap ? (
            <RecapViewer content={recap.content} title={recap.title} />
          ) : (
            <EmptyState
              icon={<span>📝</span>}
              title="No recap yet"
              description="Create a recap to add notes and summaries for this book."
            />
          )}
        </div>
      )}

      {activeTab === "test" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Test</h2>
            <button
              onClick={() => navigate(`/self-study/books/${bookId}/test`)}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
            >
              {test ? "Manage Test" : "Create Test"}
            </button>
          </div>
          {test ? (
            <div>
              {test.instructions && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h3>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">{test.instructions}</p>
                </div>
              )}
              <a
                href={test.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Test File
              </a>
            </div>
          ) : (
            <EmptyState
              icon={<span>📋</span>}
              title="No test yet"
              description="Create a test by uploading a Google Drive link for students to access."
            />
          )}
        </div>
      )}
    </div>
  );
}

function QuizPreview({ questions }: { questions: Question[] }) {
  const totalTime = questions.reduce((sum, q) => sum + (q.time_limit_seconds || 0), 0);
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Preview Mode</p>
          <p>
            This is how students will see the quiz. {questions.length} question{questions.length !== 1 ? "s" : ""},
            {minutes > 0 ? ` ${minutes}m` : ""}{seconds > 0 ? ` ${seconds}s` : ""} total time.
            Correct answers are highlighted in green.
          </p>
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, idx) => {
        const options = [
          { key: "A", text: q.option_a },
          { key: "B", text: q.option_b },
          { key: "C", text: q.option_c },
          { key: "D", text: q.option_d },
        ];

        return (
          <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Question {idx + 1}</span>
              <span className="text-xs text-gray-400">{q.time_limit_seconds}s</span>
            </div>

            <p className="text-gray-800 mb-4 leading-relaxed">
              <MathText text={q.question_text} />
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map(({ key, text }) => {
                const isCorrect = key === q.correct_option;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                      isCorrect
                        ? "border-green-400 bg-green-50 text-green-800"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCorrect
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {isCorrect ? "\u2713" : key}
                    </span>
                    <MathText text={text} />
                  </div>
                );
              })}
            </div>

            {q.explanation && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Explanation: </span>
                  <MathText text={q.explanation} />
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
