import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  Percent,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Eye,
} from 'lucide-react';
import { Card } from '../common/Card';
import { StatWidget } from '../common/StatWidget';
import { PracticeSession, PracticeAttempt } from '../../types';
import { formatTimeHHMMSS } from '../../utils/formatters';
import { MathFormattedText } from '../common/MathFormattedText';
import { PdfPageModal } from '../common/PdfPageModal';

interface PracticeResultsProps {
  session: PracticeSession;
  onRestart: () => void;
  onDashboard: () => void;
}

export const PracticeResults: React.FC<PracticeResultsProps> = ({
  session,
  onRestart,
  onDashboard,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');
  const [expandedQId, setExpandedQId] = useState<string | null>(null);
  const [viewingPdfQuestion, setViewingPdfQuestion] = useState<PracticeAttempt | null>(null);

  const questions = session.questions || [];
  const totalQuestions = session.total_questions || questions.length;

  const correctQuestions = questions.filter((q) => q.is_correct === 1);
  const incorrectQuestions = questions.filter((q) => q.is_correct === 0);
  const skippedQuestions = questions.filter(
    (q) => q.selected_option === null || q.selected_option === undefined || q.selected_option === ''
  );

  const attemptedCount = correctQuestions.length + incorrectQuestions.length;
  const accuracyPct =
    attemptedCount > 0 ? Math.round((correctQuestions.length / attemptedCount) * 100) : 0;

  const elapsedSeconds = session.elapsed_seconds || 0;
  const avgTimePerQuestion =
    totalQuestions > 0 ? Math.round(elapsedSeconds / totalQuestions) : 0;

  const config = session.config || {};
  const correctMarks = config.correct_marks !== undefined ? config.correct_marks : 2.0;
  const negativeMarks = config.negative_marks !== undefined ? config.negative_marks : 0.5;

  const filteredQuestions = questions.filter((q) => {
    if (filterMode === 'correct') return q.is_correct === 1;
    if (filterMode === 'incorrect') return q.is_correct === 0;
    if (filterMode === 'skipped')
      return q.selected_option === null || q.selected_option === undefined || q.selected_option === '';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner with Final Score & Timing */}
      <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 font-medium">
              Performance Summary
            </span>
            <span className="text-xs text-neutral-400 capitalize">
              {config.mode || 'Practice'} Mode
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Final Score: <span className="font-mono text-emerald-400">{session.score}</span> pts
          </h2>
          <p className="text-xs text-neutral-400">
            Marking scheme: +{correctMarks} for correct, -{negativeMarks} for incorrect. Unanswered items carry 0 marks.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Practice Again</span>
          </button>
          <button
            onClick={onDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatWidget
          label="Total Questions"
          value={totalQuestions}
          subValue={`${attemptedCount} attempted (${totalQuestions - attemptedCount} skipped)`}
          icon={Layers}
        />
        <StatWidget
          label="Accuracy"
          value={`${accuracyPct}%`}
          subValue={`${correctQuestions.length} correct out of ${attemptedCount}`}
          icon={Percent}
          badge={accuracyPct >= 70 ? 'High' : 'Needs Practice'}
          badgeVariant={accuracyPct >= 70 ? 'success' : 'warning'}
        />
        <StatWidget
          label="Time Taken"
          value={formatTimeHHMMSS(elapsedSeconds)}
          subValue={`Avg: ${avgTimePerQuestion}s per question`}
          icon={Clock}
        />
        <StatWidget
          label="Score Breakdown"
          value={`${correctQuestions.length * correctMarks - incorrectQuestions.length * negativeMarks}`}
          subValue={`+${correctQuestions.length * correctMarks} / -${incorrectQuestions.length * negativeMarks}`}
          icon={Award}
        />
      </div>

      {/* Question Review Section */}
      <Card
        title="Detailed Question-by-Question Review"
        subtitle="Compare your selected response against original verified keys and source PDF pages"
        action={
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {(['all', 'correct', 'incorrect', 'skipped'] as const).map((modeKey) => (
              <button
                key={modeKey}
                onClick={() => setFilterMode(modeKey)}
                className={`px-2.5 py-1 rounded-lg capitalize border cursor-pointer transition-colors ${
                  filterMode === modeKey
                    ? 'bg-neutral-800 text-white border-neutral-600'
                    : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
                }`}
              >
                {modeKey}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          {filteredQuestions.map((q, qIndex) => {
            const isCorrect = q.is_correct === 1;
            const isIncorrect = q.is_correct === 0;
            const isSkipped = !q.selected_option;
            const isExpanded = expandedQId === q.question_id;

            return (
              <div
                key={q.question_id}
                className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/70 space-y-3"
              >
                {/* Review Header */}
                <div className="flex items-center justify-between gap-3 border-b border-neutral-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                      Q.{q.question_order + 1}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border capitalize flex items-center gap-1 ${
                        isCorrect
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                          : isIncorrect
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      {isCorrect && <CheckCircle2 className="w-3 h-3" />}
                      {isIncorrect && <XCircle className="w-3 h-3" />}
                      {isSkipped && <HelpCircle className="w-3 h-3" />}
                      {isCorrect ? 'Correct (+2)' : isIncorrect ? 'Incorrect (-0.5)' : 'Skipped (0)'}
                    </span>
                    {q.subject && (
                      <span className="text-[11px] font-mono text-neutral-500">
                        {q.subject}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-neutral-500 font-mono">
                    <span>Spent: {q.time_spent_seconds}s</span>
                    {q.page_image_url && (
                      <button
                        onClick={() => setViewingPdfQuestion(q)}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
                        title="View original PDF page"
                      >
                        <Eye className="w-3 h-3" />
                        <span>p.{q.page_number}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedQId(isExpanded ? null : q.question_id)}
                      className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Question Stem */}
                <div className="text-xs text-neutral-200 leading-relaxed font-sans">
                  <MathFormattedText text={q.question_text} />
                </div>

                {/* Options Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {q.options?.map((opt, oIdx) => {
                    const isUserChoice = q.selected_option === opt.label;
                    const isKeyAnswer = q.correct_answer === opt.label;

                    let optStyle = 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400';
                    if (isKeyAnswer) {
                      optStyle = 'bg-emerald-950/30 border-emerald-700 text-emerald-200 font-medium';
                    } else if (isUserChoice && !isCorrect) {
                      optStyle = 'bg-rose-950/30 border-rose-800 text-rose-200 line-through';
                    }

                    return (
                      <div
                        key={oIdx}
                        className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${optStyle}`}
                      >
                        <span
                          className={`w-5 h-5 rounded font-mono text-[11px] font-bold flex items-center justify-center shrink-0 ${
                            isKeyAnswer
                              ? 'bg-emerald-500 text-neutral-950'
                              : isUserChoice
                              ? 'bg-rose-500 text-white'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <div className="flex-1 leading-tight">
                          <MathFormattedText text={opt.text} />
                          {isUserChoice && (
                            <span className="ml-2 font-mono text-[10px] opacity-80">
                              (Your Answer)
                            </span>
                          )}
                          {isKeyAnswer && (
                            <span className="ml-2 font-mono text-[10px] text-emerald-400">
                              ✓ Correct Answer
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded Traceability & Explanation */}
                {isExpanded && (
                  <div className="p-3 rounded-lg bg-neutral-900/40 border border-neutral-800/60 space-y-2 text-xs text-neutral-400 pt-3">
                    <div className="flex items-center gap-2 text-neutral-300 font-medium">
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                      <span>
                        Source: {q.source_filename} (Page {q.page_number})
                      </span>
                    </div>
                    {q.explanation ? (
                      <div className="text-neutral-300">
                        <MathFormattedText text={q.explanation} />
                      </div>
                    ) : (
                      <p className="text-neutral-500 italic">No explanation recorded in source PDF.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* PDF Page Modal */}
      {viewingPdfQuestion && viewingPdfQuestion.page_image_url && (
        <PdfPageModal
          imageUrl={viewingPdfQuestion.page_image_url}
          pageNumber={viewingPdfQuestion.page_number}
          sourceFilename={viewingPdfQuestion.source_filename}
          questionNumber={viewingPdfQuestion.raw_question_number}
          onClose={() => setViewingPdfQuestion(null)}
        />
      )}
    </div>
  );
};
