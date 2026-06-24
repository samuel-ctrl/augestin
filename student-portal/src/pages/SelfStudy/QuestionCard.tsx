import { useState, useEffect, useCallback } from "react";
import { MathText, isGoogleDriveUrl, extractFileId } from "@shared";
import type { Question } from "@shared";

function resolveImageUrl(url: string, size: number): string {
  if (!isGoogleDriveUrl(url)) return url;
  const fileId = extractFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  isSkipped: boolean;
  onSubmit: (questionId: string, selectedOption: string | null, isSkipped: boolean) => void;
  onSkip: (questionId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  disabled?: boolean;
}

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  isSkipped,
  onSubmit,
  onSkip,
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
  disabled,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(selectedAnswer);

  // Sync when question changes or selectedAnswer updates
  useEffect(() => {
    setSelected(selectedAnswer);
  }, [selectedAnswer, question.id]);

  const handleSelect = useCallback(
    (option: string) => {
      if (disabled) return;
      setSelected(option);
      // Auto-save answer immediately
      onSubmit(question.id, option, false);
    },
    [disabled, question.id, onSubmit]
  );

  const handleSkip = useCallback(() => {
    if (disabled) return;
    setSelected(null);
    onSkip(question.id);
  }, [disabled, question.id, onSkip]);

  const options = [
    { key: "A", text: question.option_a, imageUrl: question.option_a_image_url },
    { key: "B", text: question.option_b, imageUrl: question.option_b_image_url },
    { key: "C", text: question.option_c, imageUrl: question.option_c_image_url },
    { key: "D", text: question.option_d, imageUrl: question.option_d_image_url },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Question */}
      <div className="mb-6">
        <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
          <span className="text-gray-400 dark:text-gray-500 text-sm mr-1">Q{questionNumber}.</span>
          <MathText text={question.question_text} />
        </p>
        {question.question_image_url && (
          <img
            src={resolveImageUrl(question.question_image_url, 1600)}
            alt="Question visual"
            className="mt-4 max-w-full h-auto rounded"
          />
        )}
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {options.map(({ key, text, imageUrl }) => {
          const isSelected = selected === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              disabled={disabled}
              className={`w-full flex flex-col gap-3 p-3 rounded-lg border transition-colors text-left ${
                isSelected
                  ? "border-primary-400 bg-primary-50"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-medium shrink-0 ${
                    isSelected
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {key}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  <MathText text={text} />
                </span>
              </div>
              {imageUrl && (
                <img
                  src={resolveImageUrl(imageUrl, 800)}
                  alt={`Option ${key}`}
                  className="max-w-full h-auto rounded ml-10"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Skip Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleSkip}
          disabled={disabled}
          className={`w-full px-4 py-2 text-sm rounded-lg border transition-colors ${
            isSkipped
              ? "border-yellow-400 bg-yellow-50 text-yellow-700"
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          ⏭️ Skip this question
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Previous
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {questionNumber} / {totalQuestions}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="px-4 py-2 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
