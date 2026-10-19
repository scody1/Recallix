import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCw,
  Flame,
  Bookmark,
  AlertTriangle,
  SkipForward,
  History,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  Check,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { api, BACKEND_BASE } from '../../services/api';
import { MathFormattedText } from '../../components/common/MathFormattedText';
import {
  RevisionItem,
  RevisionFilterType,
  MistakeCategory,
  RevisionStats,
  NavSection
} from '../../types';

interface RevisionCentrePageProps {
  onNavigate: (section: NavSection) => void;
}

const MISTAKE_OPTIONS: { id: MistakeCategory; label: string; color: string }[] = [
  { id: 'concept_not_clear', label: 'Concept not clear', color: 'border-red-500/50 text-red-300 hover:bg-red-500/10' },
  { id: 'calculation_error', label: 'Calculation error', color: 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10' },
  { id: 'silly_mistake', label: 'Silly mistake', color: 'border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10' },
  { id: 'misread_question', label: 'Misread question', color: 'border-orange-500/50 text-orange-300 hover:bg-orange-500/10' },
  { id: 'time_pressure', label: 'Time pressure', color: 'border-purple-500/50 text-purple-300 hover:bg-purple-500/10' },
  { id: 'guessed_answer', label: 'Guessed answer', color: 'border-blue-500/50 text-blue-300 hover:bg-blue-500/10' },
  { id: 'other', label: 'Other', color: 'border-neutral-500/50 text-neutral-300 hover:bg-neutral-500/10' },
];

export const RevisionCentrePage: React.FC<RevisionCentrePageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<RevisionStats>({
    due_count: 0,
    incorrect_count: 0,
    skipped_count: 0,
    bookmarked_count: 0,
    difficult_count: 0,
    total_attempted: 0,
  });

  const [activeFilter, setActiveFilter] = useState<RevisionFilterType>('due');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [items, setItems] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Per-question state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [reattemptResults, setReattemptResults] = useState<Record<string, { is_correct: number; correct_answer?: string }>>({});
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});
  const [expandedPageViews, setExpandedPageViews] = useState<Record<string, boolean>>({});
  const [savingAction, setSavingAction] = useState<Record<string, boolean>>({});

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getRevisionStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load revision stats', e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRevisionItems({
        filter_type: activeFilter,
        subject: subjectFilter,
        search: searchQuery.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      setItems(res.items);
      setTotalCount(res.total);
    } catch (e) {
      console.error('Failed to load revision items', e);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, subjectFilter, searchQuery]);

  useEffect(() => {
    loadStats();
    loadItems();
  }, [loadStats, loadItems]);

  const handleClassifyMistake = async (questionId: string, mistakeCat: MistakeCategory) => {
    setSavingAction(prev => ({ ...prev, [questionId]: true }));
    try {
      await api.classifyMistake(questionId, mistakeCat);
      setItems(prev =>
        prev.map(item =>
          item.id === questionId ? { ...item, mistake_category: mistakeCat } : item
        )
      );
    } catch (e) {
      console.error('Failed to classify mistake', e);
    } finally {
      setSavingAction(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleToggleDifficult = async (questionId: string) => {
    try {
      const isDifficult = await api.toggleRevisionDifficult(questionId);
      setItems(prev =>
        prev.map(item =>
          item.id === questionId ? { ...item, is_difficult: isDifficult ? 1 : 0 } : item
        )
      );
      loadStats();
    } catch (e) {
      console.error('Failed to toggle difficult', e);
    }
  };

  const handleToggleBookmark = async (questionId: string) => {
    try {
      const isBookmarked = await api.toggleBookmark(questionId);
      setItems(prev =>
        prev.map(item =>
          item.id === questionId ? { ...item, is_bookmarked: isBookmarked ? 1 : 0 } : item
        )
      );
      loadStats();
    } catch (e) {
      console.error('Failed to toggle bookmark', e);
    }
  };

  const handleReattempt = async (item: RevisionItem) => {
    const chosen = selectedAnswers[item.id];
    if (!chosen) return;

    setSavingAction(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await api.recordRevisionReattempt({
        question_id: item.id,
        selected_option: chosen,
        mistake_category: item.mistake_category || undefined,
        is_difficult: item.is_difficult === 1,
      });

      setReattemptResults(prev => ({
        ...prev,
        [item.id]: { is_correct: res.is_correct, correct_answer: res.correct_answer },
      }));

      if (res.item) {
        setItems(prev =>
          prev.map(it => (it.id === item.id ? { ...res.item!, is_bookmarked: it.is_bookmarked } : it))
        );
      }
      loadStats();
    } catch (e) {
      console.error('Failed to record reattempt', e);
    } finally {
      setSavingAction(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const getDueBadge = (item: RevisionItem) => {
    if (!item.due_date) return null;
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = item.due_date < today;
    const isToday = item.due_date === today;

    if (isOverdue || isToday) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/70 text-red-300 border border-red-800/60 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Due {isToday ? 'Today' : 'Overdue'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800/80 text-neutral-300 border border-neutral-700/60 flex items-center gap-1">
        <Calendar className="w-3 h-3" /> Due in {item.interval_days || 1}d ({item.due_date})
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <button
          onClick={() => setActiveFilter('due')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeFilter === 'due'
              ? 'border-indigo-500 bg-indigo-950/30'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs mb-1">
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Due for Review</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">{stats.due_count}</span>
          <p className="text-[10px] text-neutral-500 mt-0.5">Spaced queue</p>
        </button>

        <button
          onClick={() => setActiveFilter('incorrect')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeFilter === 'incorrect'
              ? 'border-red-500 bg-red-950/30'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs mb-1">
            <Flame className="w-3.5 h-3.5 text-red-500" />
            <span>Incorrect</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">{stats.incorrect_count}</span>
          <p className="text-[10px] text-neutral-500 mt-0.5">Mistake tracker</p>
        </button>

        <button
          onClick={() => setActiveFilter('skipped')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeFilter === 'skipped'
              ? 'border-amber-500 bg-amber-950/30'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs mb-1">
            <SkipForward className="w-3.5 h-3.5 text-amber-500" />
            <span>Skipped</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">{stats.skipped_count}</span>
          <p className="text-[10px] text-neutral-500 mt-0.5">Unanswered</p>
        </button>

        <button
          onClick={() => setActiveFilter('bookmarked')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeFilter === 'bookmarked'
              ? 'border-cyan-500 bg-cyan-950/30'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs mb-1">
            <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
            <span>Bookmarked</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">{stats.bookmarked_count}</span>
          <p className="text-[10px] text-neutral-500 mt-0.5">Saved drills</p>
        </button>

        <button
          onClick={() => setActiveFilter('difficult')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeFilter === 'difficult'
              ? 'border-yellow-500 bg-yellow-950/30'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span>Difficult</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">{stats.difficult_count}</span>
          <p className="text-[10px] text-neutral-500 mt-0.5">Flagged review</p>
        </button>

        <button
          onClick={() => setActiveFilter('all_attempted')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeFilter === 'all_attempted'
              ? 'border-emerald-500 bg-emerald-950/30'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs mb-1">
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>All Attempted</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">{stats.total_attempted}</span>
          <p className="text-[10px] text-neutral-500 mt-0.5">Full history</p>
        </button>
      </div>

      {/* Spaced Repetition Engine Rules Strip */}
      <div className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-900/40 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-neutral-500" />
          <span className="font-medium text-neutral-300">Spaced Repetition Protocol:</span>
          <span>Incorrect (+1d)</span>
          <span className="text-neutral-600">•</span>
          <span>Difficult (+2d)</span>
          <span className="text-neutral-600">•</span>
          <span>Correct (+5d)</span>
          <span className="text-neutral-600">•</span>
          <span>Consistently Correct (+14d)</span>
        </div>
        <div className="text-[11px] text-neutral-500">
          Permanent retention enabled: questions stay in rotation based on performance.
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-900/70">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All Subjects</option>
            <option value="Quantitative Aptitude">Quantitative Aptitude</option>
            <option value="Reasoning">Reasoning</option>
            <option value="English">English</option>
            <option value="General Studies">General Studies</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search question text or Q#..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 w-52"
            />
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-neutral-400">
          <span>{totalCount} questions found</span>
          <button
            onClick={() => { loadStats(); loadItems(); }}
            className="p-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title="Refresh questions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-neutral-500 gap-3">
          <RotateCw className="w-6 h-6 animate-spin text-neutral-400" />
          <p className="text-sm">Loading revision items...</p>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-base font-medium text-neutral-200">
              {activeFilter === 'due'
                ? 'All Caught Up!'
                : `No questions found in ${activeFilter.replace('_', ' ')}`}
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              {activeFilter === 'due'
                ? 'No questions are due for spaced repetition review today. Attempt practice drills or inspect other categories.'
                : 'Questions will populate here automatically as you attempt practice drills and classify your mistakes.'}
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('practice-arena')}
                className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-950 text-xs font-semibold hover:bg-white transition-colors"
              >
                Go to Practice Drills
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const hasReattempted = !!reattemptResults[item.id];
            const result = reattemptResults[item.id];
            const currentSelected = selectedAnswers[item.id] || (item.latest_attempt?.selected_option || '');
            const isHistoryOpen = !!expandedHistories[item.id];
            const isPageOpen = !!expandedPageViews[item.id];

            return (
              <div
                key={item.id}
                className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-4 transition-all hover:border-neutral-750"
              >
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-200">
                      {item.raw_question_number ? `Q.${item.raw_question_number}` : 'Question'}
                    </span>
                    {item.subject && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800/60 text-neutral-300">
                        {item.subject}
                      </span>
                    )}
                    {item.topic && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800/40 text-neutral-400">
                        {item.topic}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {item.source_filename} (p. {item.page_number})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getDueBadge(item)}

                    {item.streak !== undefined && item.streak > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                        Streak: {item.streak}
                      </span>
                    )}

                    <button
                      onClick={() => handleToggleDifficult(item.id)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        item.is_difficult === 1
                          ? 'border-yellow-500/70 bg-yellow-500/20 text-yellow-300'
                          : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }`}
                      title={item.is_difficult === 1 ? 'Marked as Difficult' : 'Flag as Difficult'}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleBookmark(item.id)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        item.is_bookmarked === 1
                          ? 'border-cyan-500/70 bg-cyan-500/20 text-cyan-300'
                          : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }`}
                      title={item.is_bookmarked === 1 ? 'Remove Bookmark' : 'Bookmark Question'}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Stem */}
                <div className="text-sm text-neutral-100 font-normal leading-relaxed">
                  <MathFormattedText text={item.question_text} />
                </div>

                {/* Options List / Interactive Re-attempt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {item.options && item.options.length > 0 ? (
                    item.options.map(opt => {
                      const optLabel = opt.label || (opt as any).key || '';
                      const isOptionSelected = currentSelected.toUpperCase() === optLabel.toUpperCase();
                      const isOptionCorrect = item.correct_answer && item.correct_answer.toUpperCase() === optLabel.toUpperCase();
                      const wasPreviousAttemptAnswer = item.latest_attempt?.selected_option?.toUpperCase() === optLabel.toUpperCase();

                      let btnStyle = 'border-neutral-800 bg-neutral-950/50 text-neutral-300 hover:border-neutral-700';

                      if (hasReattempted) {
                        if (isOptionCorrect) {
                          btnStyle = 'border-emerald-600 bg-emerald-950/40 text-emerald-200 font-medium';
                        } else if (isOptionSelected && !result?.is_correct) {
                          btnStyle = 'border-red-600 bg-red-950/40 text-red-200';
                        }
                      } else if (isOptionSelected) {
                        btnStyle = 'border-indigo-500 bg-indigo-950/30 text-indigo-200';
                      }

                      return (
                        <button
                          key={optLabel}
                          type="button"
                          onClick={() => {
                            if (!hasReattempted) {
                              setSelectedAnswers(prev => ({ ...prev, [item.id]: optLabel }));
                            }
                          }}
                          className={`p-3 rounded-lg border text-left text-xs transition-all flex items-start gap-2.5 ${btnStyle}`}
                        >
                          <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300 shrink-0">
                            {optLabel}
                          </span>
                          <span className="flex-1 leading-snug">
                            <MathFormattedText text={opt.text} />
                          </span>
                          {hasReattempted && isOptionCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                          {!hasReattempted && wasPreviousAttemptAnswer && (
                            <span className="text-[10px] text-neutral-500 font-mono px-1 py-0.5 bg-neutral-900 rounded border border-neutral-800">
                              Prev Ans
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-xs text-neutral-500 italic col-span-2">
                      Options extracted as raw text or not separated.
                    </div>
                  )}
                </div>

                {/* Re-attempt Action and Feedback Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/60">
                  <div className="flex items-center gap-2">
                    {!hasReattempted ? (
                      <button
                        onClick={() => handleReattempt(item)}
                        disabled={!selectedAnswers[item.id] || savingAction[item.id]}
                        className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-950 text-xs font-medium hover:bg-white disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
                      >
                        {savingAction[item.id] ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Check & Re-attempt
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        {result?.is_correct === 1 ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Correct! Next revision interval updated.
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1 font-medium">
                            <XCircle className="w-4 h-4" /> Incorrect. Scheduled for tomorrow.
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setReattemptResults(prev => {
                              const copy = { ...prev };
                              delete copy[item.id];
                              return copy;
                            });
                          }}
                          className="text-[11px] text-neutral-500 hover:text-neutral-300 underline ml-2"
                        >
                          Retry again
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    {item.correct_answer && (
                      <span className="text-neutral-400">
                        Correct Answer: <strong className="text-emerald-400 font-mono">{item.correct_answer}</strong>
                      </span>
                    )}
                    {item.latest_attempt?.selected_option && (
                      <span className="text-neutral-500">
                        • Prev Choice: <strong className="text-neutral-300 font-mono">{item.latest_attempt.selected_option}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* One-Click Mistake Classification Chips */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <Tag className="w-3.5 h-3.5 text-neutral-500" />
                    <span>One-click Mistake Reason:</span>
                    {item.mistake_category && (
                      <span className="text-[11px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                        Classified: {item.mistake_category.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {MISTAKE_OPTIONS.map(opt => {
                      const isCurrent = item.mistake_category === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleClassifyMistake(item.id, opt.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] border transition-all ${
                            isCurrent
                              ? 'bg-neutral-800 border-neutral-600 font-medium text-white ring-1 ring-neutral-500'
                              : `bg-neutral-950/80 ${opt.color}`
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Source-Provided Explanation */}
                {item.explanation && (
                  <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/70 text-xs text-neutral-300 space-y-1">
                    <div className="flex items-center gap-1.5 text-neutral-400 font-medium">
                      <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Source-Provided Explanation (from PDF):</span>
                    </div>
                    <div className="leading-relaxed text-neutral-300 font-sans">
                      <MathFormattedText text={item.explanation} />
                    </div>
                  </div>
                )}

                {/* Collapsible Attempt History & Original Snapshot */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  {item.attempts_history && item.attempts_history.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedHistories(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{item.attempts_history.length} Previous Attempt{item.attempts_history.length > 1 ? 's' : ''}</span>
                      {isHistoryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}

                  {item.page_image_url && (
                    <button
                      onClick={() =>
                        setExpandedPageViews(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="text-neutral-400 hover:text-neutral-200 flex items-center gap-1 ml-auto"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Original PDF Page Snapshot</span>
                      {isPageOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* History Dropdown */}
                {isHistoryOpen && item.attempts_history && (
                  <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/90 text-xs space-y-2">
                    <div className="text-neutral-400 font-medium">Attempt Log History:</div>
                    <div className="divide-y divide-neutral-900">
                      {item.attempts_history.map((log, idx) => (
                        <div key={log.id || idx} className="py-1.5 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-neutral-500">#{item.attempts_history.length - idx}</span>
                            <span className="text-neutral-400">{log.attempt_date || log.created_at?.split('T')[0]}</span>
                            <span>Selected: <strong className="font-mono text-neutral-200">{log.selected_option || 'None'}</strong></span>
                            {log.is_correct === 1 ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Correct
                              </span>
                            ) : log.is_correct === 0 ? (
                              <span className="text-red-400 font-medium flex items-center gap-0.5">
                                <XCircle className="w-3 h-3" /> Incorrect
                              </span>
                            ) : (
                              <span className="text-amber-400">Skipped</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-neutral-400">
                            {log.mistake_category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-amber-300">
                                {log.mistake_category.replace('_', ' ')}
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-neutral-500">
                              Interval: +{log.interval_assigned}d
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page Snapshot Dropdown */}
                {isPageOpen && item.page_image_url && (
                  <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
                    <div className="text-xs text-neutral-400">Original Page Snapshot (PDF Page {item.page_number}):</div>
                    <div className="overflow-auto max-h-96 rounded border border-neutral-800">
                      <img
                        src={`${BACKEND_BASE}${item.page_image_url}`}
                        alt={`Page ${item.page_number}`}
                        className="w-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
