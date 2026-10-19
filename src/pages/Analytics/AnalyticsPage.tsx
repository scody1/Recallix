import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Clock,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Download,
  Filter,
  RefreshCw,
  Target,
  Sparkles,
  Layers,
  ArrowRight,
  Flame,
  HelpCircle,
  FileSpreadsheet,
  XCircle,
  Hourglass,
  Tag,
  Settings,
  Check
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatWidget } from '../../components/common/StatWidget';
import { useTimer } from '../../context/TimerContext';
import {
  AnalyticsOverview,
  NavSection,
  SubjectWiseAnalytics,
  TopicWiseAnalytics
} from '../../types';
import { api } from '../../services/api';
import { formatTimeHHMMSS, formatDurationHuman } from '../../utils/formatters';

interface AnalyticsPageProps {
  onNavigate?: (section: NavSection) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate }) => {
  const { todayActiveSeconds } = useTimer();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [dateRange, setDateRange] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Goals Config Modal / Inline State
  const [editingGoals, setEditingGoals] = useState<boolean>(false);
  const [goalHours, setGoalHours] = useState<number>(2.0);
  const [goalQuestions, setGoalQuestions] = useState<number>(50);
  const [qaTarget, setQaTarget] = useState<number>(20);
  const [reasoningTarget, setReasoningTarget] = useState<number>(15);
  const [englishTarget, setEnglishTarget] = useState<number>(10);
  const [gsTarget, setGsTarget] = useState<number>(5);
  const [savingGoals, setSavingGoals] = useState<boolean>(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await api.getAnalyticsOverview({
        date_range: dateRange,
        subject: subjectFilter,
      });
      setData(overview);
      if (overview.goals_progress) {
        setGoalHours(overview.goals_progress.daily_hours_target || 2.0);
        setGoalQuestions(overview.goals_progress.daily_question_target || 50);
        const st = overview.goals_progress.subject_targets || {};
        setQaTarget(st['Quantitative Aptitude'] || 20);
        setReasoningTarget(st['Reasoning'] || 15);
        setEnglishTarget(st['English'] || 10);
        setGsTarget(st['General Studies'] || 5);
      }
    } catch (err) {
      console.error('Failed to load analytics overview', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, subjectFilter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    try {
      await api.saveStudyGoals({
        daily_hours_target: goalHours,
        daily_question_target: goalQuestions,
        subject_targets: {
          'Quantitative Aptitude': qaTarget,
          'Reasoning': reasoningTarget,
          'English': englishTarget,
          'General Studies': gsTarget,
        },
      });
      setEditingGoals(false);
      loadAnalytics();
    } catch (e) {
      console.error('Failed to save study goals', e);
    } finally {
      setSavingGoals(false);
    }
  };

  const handleExport = (reportType: string) => {
    const url = api.getReportExportUrl(reportType);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const perf = data?.performance_analytics;
  const intel = data?.preparation_intelligence;
  const dash = data?.dashboard_metrics;
  const goals = data?.goals_progress;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Performance & Preparation Intelligence
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Empirical progress metrics derived strictly from actual question attempts and stopwatch sessions.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Subjects</option>
            <option value="Quantitative Aptitude">Quantitative Aptitude</option>
            <option value="Reasoning">Reasoning</option>
            <option value="English">English</option>
            <option value="General Studies">General Studies</option>
          </select>

          <button
            onClick={loadAnalytics}
            className="p-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <span className="text-[11px] text-neutral-400 block mb-1">Overall Accuracy</span>
          <span className="text-xl font-bold font-mono text-white">
            {perf ? `${perf.subject_wise.reduce((acc, s) => acc + s.correct_attempts, 0) > 0 ? dash?.overall_accuracy : 0}%` : '—'}
          </span>
          <span className="text-[10px] text-neutral-500 block mt-0.5">Across {dash?.total_attempts || 0} attempts</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <span className="text-[11px] text-neutral-400 block mb-1">Avg Time / Question</span>
          <span className="text-xl font-bold font-mono text-white">
            {perf?.avg_time_per_question ? `${perf.avg_time_per_question}s` : '—'}
          </span>
          <span className="text-[10px] text-neutral-500 block mt-0.5">Active drill pace</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <span className="text-[11px] text-neutral-400 block mb-1">Revision Retention</span>
          <span className="text-xl font-bold font-mono text-emerald-400">
            {perf ? `${perf.revision_success_rate}%` : '—'}
          </span>
          <span className="text-[10px] text-neutral-500 block mt-0.5">Re-attempt success rate</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <span className="text-[11px] text-neutral-400 block mb-1">Unique Completed</span>
          <span className="text-xl font-bold font-mono text-white">{dash?.unique_questions_attempted || 0}</span>
          <span className="text-[10px] text-neutral-500 block mt-0.5">Coverage: {dash?.total_questions_in_library ? Math.round((dash.unique_questions_attempted / dash.total_questions_in_library) * 100) : 0}%</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <span className="text-[11px] text-neutral-400 block mb-1">Total Active Study</span>
          <span className="text-xl font-bold font-mono text-white">
            {formatDurationHuman(dash?.total_active_study_time_seconds || 0)}
          </span>
          <span className="text-[10px] text-neutral-500 block mt-0.5">Excludes pauses</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <span className="text-[11px] text-neutral-400 block mb-1">Revision Due Today</span>
          <span className={`text-xl font-bold font-mono ${dash && dash.revision_due_count > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
            {dash?.revision_due_count || 0}
          </span>
          <span className="text-[10px] text-neutral-500 block mt-0.5">Awaiting spaced review</span>
        </div>
      </div>

      {/* SECTION 1: STUDY GOALS & PROGRESS */}
      <Card
        title="Study Targets & Daily Discipline"
        subtitle="Configure daily hour and question goals with optional subject targets"
        action={
          <button
            onClick={() => setEditingGoals(!editingGoals)}
            className="text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 border border-neutral-700/60"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{editingGoals ? 'Cancel' : 'Configure Targets'}</span>
          </button>
        }
      >
        {editingGoals ? (
          <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1 font-medium">
                  Daily Study Hours Target (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  value={goalHours}
                  onChange={(e) => setGoalHours(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 rounded bg-neutral-900 border border-neutral-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1 font-medium">
                  Daily Total Questions Target
                </label>
                <input
                  type="number"
                  step="5"
                  min="10"
                  max="500"
                  value={goalQuestions}
                  onChange={(e) => setGoalQuestions(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3 py-1.5 rounded bg-neutral-900 border border-neutral-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800">
              <span className="text-xs text-neutral-300 block mb-2 font-medium">
                Optional Subject-Wise Daily Question Targets:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">Quantitative Aptitude</label>
                  <input
                    type="number"
                    value={qaTarget}
                    onChange={(e) => setQaTarget(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">Reasoning</label>
                  <input
                    type="number"
                    value={reasoningTarget}
                    onChange={(e) => setReasoningTarget(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">English</label>
                  <input
                    type="number"
                    value={englishTarget}
                    onChange={(e) => setEnglishTarget(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">General Studies</label>
                  <input
                    type="number"
                    value={gsTarget}
                    onChange={(e) => setGsTarget(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingGoals(false)}
                className="px-3 py-1.5 rounded text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoals}
                disabled={savingGoals}
                className="px-4 py-1.5 rounded bg-neutral-100 hover:bg-white text-neutral-950 font-medium text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingGoals ? 'Saving...' : 'Save Targets'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Hours Target Bar */}
            <div className="p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-950/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Daily Study Time Target</span>
                <span className="font-mono text-neutral-200">
                  {formatDurationHuman(dash?.today_study_time_seconds || todayActiveSeconds)} / {goals?.daily_hours_target || 2}h
                </span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-neutral-200 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((dash?.today_study_time_seconds || todayActiveSeconds) /
                          Math.max(1, (goals?.daily_hours_target || 2) * 3600)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[11px] text-neutral-500 block">
                {Math.round(
                  ((dash?.today_study_time_seconds || todayActiveSeconds) /
                    Math.max(1, (goals?.daily_hours_target || 2) * 3600)) *
                    100
                )}
                % achieved today (clean focus without pause leakage)
              </span>
            </div>

            {/* Daily Questions Target Bar */}
            <div className="p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-950/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Daily Questions Target</span>
                <span className="font-mono text-neutral-200">
                  {goals?.today_questions_achieved || 0} / {goals?.daily_question_target || 50} Qs
                </span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-400 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((goals?.today_questions_achieved || 0) /
                          Math.max(1, goals?.daily_question_target || 50)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[11px] text-neutral-500 block">
                {Math.round(
                  ((goals?.today_questions_achieved || 0) /
                    Math.max(1, goals?.daily_question_target || 50)) *
                    100
                )}
                % completed today
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* SECTION 2: PREPARATION INTELLIGENCE RECOMMENDATIONS */}
      <Card
        title="Preparation Intelligence & Actionable Diagnostics"
        subtitle="Dynamic rule-based recommendations derived from real performance and mistake patterns"
      >
        <div className="space-y-4">
          {/* Actionable Recommendation Cards */}
          {intel?.actionable_recommendations && intel.actionable_recommendations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {intel.actionable_recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                          rec.priority === 'high'
                            ? 'bg-red-950/60 text-red-300 border-red-800/60'
                            : rec.priority === 'medium'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {rec.priority} Priority
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-white">{rec.title}</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">{rec.description}</p>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(rec.target_section)}
                      className="inline-flex items-center justify-between text-xs font-medium text-indigo-300 hover:text-white pt-2 border-t border-neutral-800/60"
                    >
                      <span>Take Action</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-neutral-500">
              No specific warnings found. Good retention and pacing across all recorded attempts!
            </div>
          )}

          {/* Diagnostic Sub-Grids */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Weakest Topics */}
            <div className="p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-950/40 space-y-2">
              <span className="text-xs font-medium text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Weakest Topics (&lt; 60% Accuracy)
              </span>
              {intel?.weakest_topics && intel.weakest_topics.length > 0 ? (
                <div className="divide-y divide-neutral-900 text-xs">
                  {intel.weakest_topics.map((wt, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span className="text-neutral-300 truncate max-w-[150px]">{wt.topic}</span>
                      <span className="font-mono text-red-400 font-medium">{wt.accuracy_pct}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 py-2">No weak topics below 60%.</p>
              )}
            </div>

            {/* Pacing Bottlenecks */}
            <div className="p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-950/40 space-y-2">
              <span className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <Hourglass className="w-3.5 h-3.5" /> Slow Topics (Pacing Bottlenecks)
              </span>
              {intel?.unusually_long_topics && intel.unusually_long_topics.length > 0 ? (
                <div className="divide-y divide-neutral-900 text-xs">
                  {intel.unusually_long_topics.map((ut, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span className="text-neutral-300 truncate max-w-[150px]">{ut.topic}</span>
                      <span className="font-mono text-amber-400 font-medium">{ut.avg_time_seconds}s</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 py-2">No pacing bottlenecks detected.</p>
              )}
            </div>

            {/* Repeated Mistakes */}
            <div className="p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-950/40 space-y-2">
              <span className="text-xs font-medium text-orange-300 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Repeated Mistakes (Fail Count &ge; 2)
              </span>
              {intel?.repeatedly_incorrect_questions && intel.repeatedly_incorrect_questions.length > 0 ? (
                <div className="divide-y divide-neutral-900 text-xs">
                  {intel.repeatedly_incorrect_questions.slice(0, 4).map((rq, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span className="text-neutral-300 truncate max-w-[160px]">
                        {rq.raw_question_number ? `Q.${rq.raw_question_number}: ` : ''}{rq.topic || 'General'}
                      </span>
                      <span className="font-mono text-orange-400 font-medium">{rq.fail_count} fails</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 py-2">No repeatedly failed questions.</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 3: SUBJECT-WISE & TOPIC-WISE PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject-Wise Performance */}
        <Card
          title="Subject-Wise Performance"
          subtitle="Accuracy, attempts count, and average solving duration by subject"
        >
          {perf?.subject_wise && perf.subject_wise.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-800 text-neutral-400 font-mono text-[11px]">
                  <tr>
                    <th className="pb-2.5 font-medium">Subject</th>
                    <th className="pb-2.5 font-medium">Attempts</th>
                    <th className="pb-2.5 font-medium">Accuracy</th>
                    <th className="pb-2.5 font-medium">Avg Time</th>
                    <th className="pb-2.5 font-medium">Unique Qs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {perf.subject_wise.map((sw) => (
                    <tr key={sw.subject} className="hover:bg-neutral-800/30">
                      <td className="py-2.5 text-neutral-200 font-sans font-medium">{sw.subject}</td>
                      <td className="py-2.5 text-neutral-400">{sw.total_attempts}</td>
                      <td className="py-2.5">
                        <span
                          className={`font-semibold ${
                            sw.accuracy_pct >= 75
                              ? 'text-emerald-400'
                              : sw.accuracy_pct >= 50
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {sw.accuracy_pct}%
                        </span>
                      </td>
                      <td className="py-2.5 text-neutral-300">{sw.avg_time_seconds}s</td>
                      <td className="py-2.5 text-neutral-400">{sw.unique_questions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500">
              No subject attempts logged for this filter range yet.
            </div>
          )}
        </Card>

        {/* Mistake Category Distribution */}
        <Card
          title="Mistake Category Distribution"
          subtitle="Self-classified error root causes from practice and revision reattempts"
        >
          {perf?.mistake_distribution && perf.mistake_distribution.length > 0 ? (
            <div className="space-y-3 py-1">
              {perf.mistake_distribution.map((m) => (
                <div key={m.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 font-medium capitalize">
                      {m.category.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-neutral-400">
                      {m.count} ({m.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400/80 h-1.5 rounded-full"
                      style={{ width: `${m.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500">
              No mistake classifications logged yet. Use the one-click classification buttons in the Revision Centre.
            </div>
          )}
        </Card>
      </div>

      {/* SECTION 4: TOPIC-WISE ACCURACY DETAIL */}
      <Card
        title="Topic-Wise Accuracy & Speed Matrix"
        subtitle="Granular breakdown across all extracted question topics"
      >
        {perf?.topic_wise && perf.topic_wise.length > 0 ? (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-800 text-neutral-400 font-mono text-[11px] sticky top-0 bg-neutral-900">
                <tr>
                  <th className="pb-2.5 font-medium">Topic</th>
                  <th className="pb-2.5 font-medium">Subject</th>
                  <th className="pb-2.5 font-medium">Attempts</th>
                  <th className="pb-2.5 font-medium">Correct</th>
                  <th className="pb-2.5 font-medium">Accuracy</th>
                  <th className="pb-2.5 font-medium">Avg Pace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {perf.topic_wise.map((tw, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/30">
                    <td className="py-2 text-neutral-200 font-sans font-medium">{tw.topic}</td>
                    <td className="py-2 text-neutral-400 font-sans">{tw.subject}</td>
                    <td className="py-2 text-neutral-300">{tw.total_attempts}</td>
                    <td className="py-2 text-neutral-400">{tw.correct_attempts}</td>
                    <td className="py-2">
                      <span
                        className={`font-semibold ${
                          tw.accuracy_pct >= 75
                            ? 'text-emerald-400'
                            : tw.accuracy_pct >= 50
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {tw.accuracy_pct}%
                      </span>
                    </td>
                    <td className="py-2 text-neutral-300">{tw.avg_time_seconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-neutral-500">
            No topic attempts recorded for current filter.
          </div>
        )}
      </Card>

      {/* SECTION 5: DATA EXPORTS & AUDIT REPORTS */}
      <Card
        title="Reports & CSV Data Export Centre"
        subtitle="Export clean, unaggregated CSV records for audit, spreadsheet analysis, and archival"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="text-xs font-semibold text-white">Attempt History</h4>
              <p className="text-[11px] text-neutral-400 mt-1">
                Full chronological question attempts with options and time spent.
              </p>
            </div>
            <button
              onClick={() => handleExport('attempts_history')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-red-400" />
              </div>
              <h4 className="text-xs font-semibold text-white">Incorrect Questions</h4>
              <p className="text-[11px] text-neutral-400 mt-1">
                Error notebook questions, mistake reasons, and correct answers.
              </p>
            </div>
            <button
              onClick={() => handleExport('incorrect_questions')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              </div>
              <h4 className="text-xs font-semibold text-white">Revision Records</h4>
              <p className="text-[11px] text-neutral-400 mt-1">
                Spaced repetition queues, due dates, intervals, and streaks.
              </p>
            </div>
            <button
              onClick={() => handleExport('revision_records')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              </div>
              <h4 className="text-xs font-semibold text-white">Study-Time History</h4>
              <p className="text-[11px] text-neutral-400 mt-1">
                Active stopwatch focus logs, sessions duration, and timestamps.
              </p>
            </div>
            <button
              onClick={() => handleExport('study_time_history')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-xs font-semibold text-white">Performance Summary</h4>
              <p className="text-[11px] text-neutral-400 mt-1">
                Aggregated accuracy and speed table by subject and topic.
              </p>
            </div>
            <button
              onClick={() => handleExport('performance_summary')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
