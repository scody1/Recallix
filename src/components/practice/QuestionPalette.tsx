import React from 'react';
import { PracticeAttempt } from '../../types';

interface QuestionPaletteProps {
  questions: PracticeAttempt[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  questions,
  currentIndex,
  onSelectIndex,
}) => {
  // Compute counts for palette legend
  let answeredCount = 0;
  let notAnsweredCount = 0;
  let markedForReviewCount = 0;
  let answeredAndMarkedCount = 0;
  let notVisitedCount = 0;

  questions.forEach((q) => {
    const hasAnswer = q.selected_option !== null && q.selected_option !== undefined && q.selected_option !== '';
    const isMarked = q.is_marked_for_review === 1;
    const isVisited = q.is_visited === 1;

    if (!isVisited) {
      notVisitedCount++;
    } else if (hasAnswer && isMarked) {
      answeredAndMarkedCount++;
    } else if (isMarked) {
      markedForReviewCount++;
    } else if (hasAnswer) {
      answeredCount++;
    } else {
      notAnsweredCount++;
    }
  });

  const getStatusStyle = (q: PracticeAttempt, isCurrent: boolean) => {
    const hasAnswer = q.selected_option !== null && q.selected_option !== undefined && q.selected_option !== '';
    const isMarked = q.is_marked_for_review === 1;
    const isVisited = q.is_visited === 1;

    let base = '';
    if (!isVisited) {
      base = 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:border-neutral-700';
    } else if (hasAnswer && isMarked) {
      base = 'bg-purple-950/70 text-purple-300 border-purple-700 relative';
    } else if (isMarked) {
      base = 'bg-indigo-950/70 text-indigo-300 border-indigo-700';
    } else if (hasAnswer) {
      base = 'bg-emerald-950/70 text-emerald-300 border-emerald-700';
    } else {
      base = 'bg-amber-950/60 text-amber-300 border-amber-800';
    }

    if (isCurrent) {
      base += ' ring-2 ring-white ring-offset-2 ring-offset-neutral-950 font-bold';
    }

    return base;
  };

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between select-none">
      <div>
        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
          Question Palette ({questions.length})
        </h4>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 mb-4 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-700 inline-block shrink-0" />
            <span>Answered ({answeredCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-950 border border-amber-800 inline-block shrink-0" />
            <span>Unanswered ({notAnsweredCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-950 border border-indigo-700 inline-block shrink-0" />
            <span>Review ({markedForReviewCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-950 border border-purple-700 inline-block shrink-0" />
            <span>Ans & Review ({answeredAndMarkedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <span className="w-3 h-3 rounded bg-neutral-900 border border-neutral-800 inline-block shrink-0" />
            <span>Not Visited ({notVisitedCount})</span>
          </div>
        </div>

        {/* Number Buttons Grid */}
        <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
          {questions.map((q, idx) => {
            const hasAnswer = q.selected_option !== null && q.selected_option !== undefined && q.selected_option !== '';
            const isMarked = q.is_marked_for_review === 1;

            return (
              <button
                key={q.question_id}
                onClick={() => onSelectIndex(idx)}
                className={`h-9 rounded-lg font-mono text-xs border flex items-center justify-center transition-all cursor-pointer ${getStatusStyle(
                  q,
                  idx === currentIndex
                )}`}
                title={`Jump to Question ${idx + 1}`}
              >
                <span>{idx + 1}</span>
                {hasAnswer && isMarked && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
