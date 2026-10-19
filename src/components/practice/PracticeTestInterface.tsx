import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Send,
  X,
  FileText,
  CornerDownLeft,
  Eye,
} from 'lucide-react';
import { PracticeSession, PracticeAttempt } from '../../types';
import { QuestionPalette } from './QuestionPalette';
import { formatTimeHHMMSS } from '../../utils/formatters';
import { api } from '../../services/api';
import { MathFormattedText } from '../common/MathFormattedText';
import { PdfPageModal } from '../common/PdfPageModal';

interface PracticeTestInterfaceProps {
  session: PracticeSession;
  onFinish: (completedSession: PracticeSession) => void;
  onExit: () => void;
}

export const PracticeTestInterface: React.FC<PracticeTestInterfaceProps> = ({
  session,
  onFinish,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(session.current_index || 0);
  const [questions, setQuestions] = useState<PracticeAttempt[]>(session.questions || []);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(session.elapsed_seconds || 0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [viewingPdfPage, setViewingPdfPage] = useState<boolean>(false);

  const mode = session.config?.mode || 'untimed';
  const isReviewMode = !!session.config?.review_mode;
  const durationTotalSeconds = (session.config?.duration_minutes || 15) * 60;
  const remainingSeconds = Math.max(0, durationTotalSeconds - elapsedSeconds);

  // Auto-sync progress to backend
  const lastSyncRef = useRef<number>(Date.now());

  const syncProgress = useCallback(
    async (idx = currentIndex, elSec = elapsedSeconds, qList = questions) => {
      try {
        await api.savePracticeProgress(session.id, {
          current_index: idx,
          elapsed_seconds: elSec,
          attempts: qList.map((q) => ({
            question_id: q.question_id,
            selected_option: q.selected_option,
            is_marked_for_review: q.is_marked_for_review,
            is_visited: q.is_visited,
            time_spent_seconds: q.time_spent_seconds,
          })),
        });
      } catch (err) {
        console.warn('Progress sync error', err);
      }
    },
    [session.id, currentIndex, elapsedSeconds, questions]
  );

  // Local Ticker for Test Timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;

        // Auto-submit in strict simulation if countdown expires
        if (mode === 'strict' && next >= durationTotalSeconds) {
          clearInterval(timer);
          handleFinalSubmit(next);
          return next;
        }

        // Periodic sync every 5 seconds
        if (Date.now() - lastSyncRef.current > 5000) {
          lastSyncRef.current = Date.now();
          syncProgress(currentIndex, next, questions);
        }

        return next;
      });

      // Increment time spent on current question
      setQuestions((prev) => {
        const updated = [...prev];
        if (updated[currentIndex]) {
          updated[currentIndex] = {
            ...updated[currentIndex],
            time_spent_seconds: (updated[currentIndex].time_spent_seconds || 0) + 1,
          };
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, mode, durationTotalSeconds, currentIndex, questions, syncProgress]);

  // Option selection
  const handleSelectOption = (optLabel: string) => {
    if (isPaused) return;
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      const newSel = cur.selected_option === optLabel ? null : optLabel;
      updated[currentIndex] = {
        ...cur,
        selected_option: newSel,
        is_visited: 1,
      };
      syncProgress(currentIndex, elapsedSeconds, updated);
      return updated;
    });
  };

  const handleClearResponse = () => {
    if (isPaused) return;
    setQuestions((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        selected_option: null,
      };
      syncProgress(currentIndex, elapsedSeconds, updated);
      return updated;
    });
  };

  const handleToggleMarkForReview = () => {
    if (isPaused) return;
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      const nextReview = cur.is_marked_for_review === 1 ? 0 : 1;
      updated[currentIndex] = {
        ...cur,
        is_marked_for_review: nextReview,
        is_visited: 1,
      };
      syncProgress(currentIndex, elapsedSeconds, updated);
      return updated;
    });
  };

  const handleNavigateQuestion = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[targetIndex]) {
        updated[targetIndex] = {
          ...updated[targetIndex],
          is_visited: 1,
        };
      }
      return updated;
    });
    setCurrentIndex(targetIndex);
    syncProgress(targetIndex, elapsedSeconds, questions);
  };

  const handleFinalSubmit = async (finalElapsed = elapsedSeconds) => {
    setIsSubmitting(true);
    try {
      const payloadAttempts = questions.map((q) => ({
        question_id: q.question_id,
        selected_option: q.selected_option,
        is_marked_for_review: q.is_marked_for_review,
        is_visited: q.is_visited,
        time_spent_seconds: q.time_spent_seconds,
      }));

      const results = await api.submitPracticeSession(session.id, {
        elapsed_seconds: finalElapsed,
        attempts: payloadAttempts,
      });

      setShowSubmitModal(false);
      onFinish(results);
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Option 1-4
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const optIdx = parseInt(e.key, 10) - 1;
        const currentQ = questions[currentIndex];
        if (currentQ && currentQ.options && currentQ.options[optIdx]) {
          handleSelectOption(currentQ.options[optIdx].label);
        }
      }

      // Left arrow: previous
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateQuestion(currentIndex - 1);
      }

      // Right arrow: next
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateQuestion(currentIndex + 1);
      }

      // Enter: next question
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleNavigateQuestion(currentIndex + 1);
      }

      // B: bookmark / mark for review
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleToggleMarkForReview();
      }

      // Ctrl + Enter: submit confirmation
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSubmitModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions, isPaused]);

  const currentQ = questions[currentIndex];
  if (!currentQ) {
    return (
      <div className="py-16 text-center text-xs text-neutral-500 font-mono">
        Loading test session...
      </div>
    );
  }

  // Answer stats for submit dialog
  const attemptedCount = questions.filter(
    (q) => q.selected_option !== null && q.selected_option !== undefined && q.selected_option !== ''
  ).length;
  const reviewCount = questions.filter((q) => q.is_marked_for_review === 1).length;
  const unansweredCount = questions.length - attemptedCount;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -mt-2 -mx-4 md:-mx-6 select-none">
      {/* Top Test Navigation & Stopwatch Bar */}
      <div className="h-14 px-6 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 capitalize">
            {mode === 'strict' ? 'Strict Simulation' : mode === 'timed' ? 'Timed Practice' : 'Untimed Drill'}
          </span>
        </div>

        {/* Test Timer (Independent of global header study timer) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400">
              {mode === 'untimed' ? 'Elapsed:' : 'Remaining:'}
            </span>
            <span
              className={`font-mono font-semibold text-sm ${
                mode !== 'untimed' && remainingSeconds < 120 ? 'text-rose-400 animate-pulse' : 'text-neutral-100'
              }`}
            >
              {mode === 'untimed' ? formatTimeHHMMSS(elapsedSeconds) : formatTimeHHMMSS(remainingSeconds)}
            </span>

            {/* Pause / Resume for timed mode (strict cannot be paused) */}
            {mode === 'timed' && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="ml-2 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title={isPaused ? 'Resume Test' : 'Pause Test'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
              </button>
            )}
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
          >
            <Send className="w-3 h-3" />
            <span>Submit Test</span>
          </button>
        </div>
      </div>

      {/* Main Test Layout: Question Workspace (Left) & Palette (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Question Viewer & Actions */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto p-6 md:p-8 bg-neutral-950/40">
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {/* Metadata Tags */}
            <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2">
                {currentQ.subject && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                    {currentQ.subject} {currentQ.topic && `• ${currentQ.topic}`}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
                  <FileText className="w-3 h-3" />
                  <span>{currentQ.source_filename}</span>
                </span>
                {currentQ.page_image_url && (
                  <button
                    onClick={() => setViewingPdfPage(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer"
                    title="View original PDF page snapshot"
                  >
                    <Eye className="w-3 h-3 text-neutral-400" />
                    <span>p.{currentQ.page_number}</span>
                  </button>
                )}
              </div>

              {/* Bookmark button */}
              <button
                onClick={handleToggleMarkForReview}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  currentQ.is_marked_for_review === 1
                    ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
                title="Press B on keyboard"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{currentQ.is_marked_for_review === 1 ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>
            </div>

            {/* Question Stem */}
            <div className="space-y-2">
              <h3 className="text-sm md:text-base font-medium text-neutral-100 leading-relaxed font-sans">
                <MathFormattedText text={currentQ.question_text} />
              </h3>
            </div>

            {/* Options List */}
            <div className="space-y-2.5 pt-2">
              {currentQ.options?.map((opt, oIdx) => {
                const isSelected = currentQ.selected_option === opt.label;
                const hasAnswered = !!currentQ.selected_option;
                const isCorrectOption = (currentQ.correct_answer || '').toUpperCase() === opt.label.toUpperCase();

                let optionStyle = 'bg-neutral-950/80 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900/60';
                if (isReviewMode && hasAnswered) {
                  if (isCorrectOption) {
                    optionStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50 shadow-sm';
                  } else if (isSelected) {
                    optionStyle = 'bg-rose-950/40 border-rose-500 text-rose-200 ring-1 ring-rose-500/50';
                  } else {
                    optionStyle = 'bg-neutral-950/40 border-neutral-900 text-neutral-500 opacity-60';
                  }
                } else if (isSelected) {
                  optionStyle = 'bg-neutral-900 border-white text-white shadow-sm ring-1 ring-white/50';
                }

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectOption(opt.label)}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${optionStyle}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg font-mono text-xs font-semibold flex items-center justify-center shrink-0 transition-colors ${
                        isReviewMode && hasAnswered && isCorrectOption
                          ? 'bg-emerald-500 text-neutral-950 font-bold'
                          : isReviewMode && hasAnswered && isSelected
                          ? 'bg-rose-500 text-neutral-950 font-bold'
                          : isSelected
                          ? 'bg-white text-neutral-950'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-xs md:text-sm leading-snug pt-0.5 flex-1">
                      <MathFormattedText text={opt.text} />
                    </span>
                    {isReviewMode && hasAnswered && isCorrectOption && (
                      <span className="text-[11px] font-mono text-emerald-400 shrink-0 font-medium self-center">
                        ✓ Correct
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Immediate Review Mode Feedback Banner */}
            {isReviewMode && currentQ.selected_option && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 mt-4 transition-all ${
                  (currentQ.correct_answer || '').toUpperCase() === currentQ.selected_option.toUpperCase()
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {(currentQ.correct_answer || '').toUpperCase() === currentQ.selected_option.toUpperCase() ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-200">
                          Correct (+{session.config?.correct_marks || 2.0} Marks)
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-200">
                          Incorrect (-{session.config?.negative_marks || 0.5} Marks) • Correct is ({currentQ.correct_answer})
                        </span>
                      </>
                    )}
                  </span>
                  {currentQ.page_image_url && (
                    <button
                      onClick={() => setViewingPdfPage(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono underline hover:text-white cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View PDF Page</span>
                    </button>
                  )}
                </div>
                {currentQ.explanation ? (
                  <div className="pt-2 border-t border-neutral-800/60 text-neutral-200 text-xs leading-relaxed font-sans">
                    <MathFormattedText text={currentQ.explanation} />
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Official answer key: ({currentQ.correct_answer}). Explanation verified from original source page {currentQ.page_number}.
                  </p>
                )}
              </div>
            )}

            {/* Keyboard helper hints */}
            <div className="pt-4 border-t border-neutral-800/40 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
              <span className="flex items-center gap-1">
                Keys <kbd className="px-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">1–4</kbd> Select option
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">B</kbd> Mark review
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">← / →</kbd> Prev/Next
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">Enter</kbd> Next
              </span>
            </div>
          </div>

          {/* Bottom Controls Bar */}
          <div className="max-w-3xl mx-auto w-full pt-6 border-t border-neutral-800/80 flex items-center justify-between">
            <button
              onClick={() => handleNavigateQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-medium text-xs border border-neutral-800 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleClearResponse}
              disabled={!currentQ.selected_option}
              className="px-3 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 text-xs transition-colors disabled:opacity-20 cursor-pointer"
            >
              Clear Response
            </button>

            <button
              onClick={() => handleNavigateQuestion(currentIndex + 1)}
              disabled={currentIndex === questions.length - 1}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 font-semibold text-xs transition-colors disabled:opacity-30 cursor-pointer shadow-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Palette & Overview */}
        <div className="w-72 border-l border-neutral-800 flex flex-col p-4 bg-neutral-950 shrink-0">
          <QuestionPalette
            questions={questions}
            currentIndex={currentIndex}
            onSelectIndex={handleNavigateQuestion}
          />
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">Confirm Test Submission</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Are you sure you want to finish and score this practice session?
                </p>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-neutral-500 hover:text-neutral-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Breakdown summary */}
            <div className="grid grid-cols-3 gap-2.5 font-mono text-center">
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                <span className="text-lg font-bold text-emerald-400">{attemptedCount}</span>
                <p className="text-[10px] text-emerald-300/80 uppercase">Attempted</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40">
                <span className="text-lg font-bold text-amber-400">{unansweredCount}</span>
                <p className="text-[10px] text-amber-300/80 uppercase">Unanswered</p>
              </div>
              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40">
                <span className="text-lg font-bold text-indigo-400">{reviewCount}</span>
                <p className="text-[10px] text-indigo-300/80 uppercase">In Review</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-3.5 py-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 text-xs font-medium cursor-pointer"
              >
                Back to Test
              </button>
              <button
                onClick={() => handleFinalSubmit()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Evaluating...' : 'Yes, Submit Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Original PDF Page Snapshot Modal */}
      {viewingPdfPage && currentQ.page_image_url && (
        <PdfPageModal
          imageUrl={currentQ.page_image_url}
          pageNumber={currentQ.page_number}
          sourceFilename={currentQ.source_filename}
          questionNumber={currentQ.raw_question_number}
          onClose={() => setViewingPdfPage(false)}
        />
      )}
    </div>
  );
};
