import { useState, useEffect, useCallback } from "react";
import { MathText } from "@shared";
import type { Question } from "@shared";

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  onSubmit: (questionId: string, selectedOption: string) => void;
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
  onSubmit,
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
      onSubmit(question.id, option);
    },
    [disabled, question.id, onSubmit]
  );

  const options = [
    { key: "A", text: question.option_a },
    { key: "B", text: question.option_b },
    { key: "C", text: question.option_c },
    { key: "D", text: question.option_d },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Question */}
      <div className="mb-6">
        <p className="text-gray-800 leading-relaxed">
          <span className="text-gray-400 text-sm mr-1">Q{questionNumber}.</span>
          <MathText text={question.question_text} />
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {options.map(({ key, text }) => {
          const isSelected = selected === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              disabled={disabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                isSelected
                  ? "border-primary-400 bg-primary-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-medium shrink-0 ${
                  isSelected
                    ? "border-primary-500 bg-primary-500 text-white"
                    : "border-gray-300 text-gray-500"
                }`}
              >
                {key}
              </span>
              <span className="text-sm text-gray-700">
                <MathText text={text} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Previous
        </button>
        <span className="text-xs text-gray-400">
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
