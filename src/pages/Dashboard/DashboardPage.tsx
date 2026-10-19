import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  HelpCircle,
  Percent,
  PlayCircle,
  Upload,
  Calendar,
  RotateCw,
  Target,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Flame,
  Layers,
  FileText
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatWidget } from '../../components/common/StatWidget';
import { useTimer } from '../../context/TimerContext';
import { NavSection, AnalyticsOverview, SystemStats } from '../../types';
import { formatTimeHHMMSS, formatDurationHuman } from '../../utils/formatters';
import { storageService } from '../../services/storage';
import { api } from '../../services/api';

interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { todayActiveSeconds, todayTargetSeconds } = useTimer();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sysStats, overview] = await Promise.all([
          api.getStats().catch(() => null),
          api.getAnalyticsOverview({ date_range: 'all' }).catch(() => null),
        ]);
        if (sysStats) setStats(sysStats);
        if (overview) setAnalytics(overview);
      } catch (err) {
        console.warn('Dashboard data loading warning', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [todayActiveSeconds]);

  const metrics = analytics?.dashboard_metrics;
  const goals = analytics?.goals_progress;
  const recs = analytics?.preparation_intelligence?.actionable_recommendations || [];

  // Active seconds display prioritizes live timer if running
  const effectiveTodaySeconds = Math.max(
    todayActiveSeconds,
    metrics?.today_study_time_seconds || 0
  );

  const dailyHourTargetSec = (goals?.daily_hours_target || 2.0) * 3600;
  const hourProgressPct = Math.min(
    100,
    Math.round((effectiveTodaySeconds / Math.max(1, dailyHourTargetSec)) * 100)
  );

  const dailyQTarget = goals?.daily_question_target || 50;
  const todayQCount = goals?.today_questions_achieved || 0;
  const qProgressPct = Math.min(
    100,
    Math.round((todayQCount / Math.max(1, dailyQTarget)) * 100)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Study Command Center
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Automatic preparation intelligence tracking question bank coverage, unique question completion, and active study sessions.
          </p>
        </div>

        {/* Quick Access Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('practice-arena')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 font-medium text-xs transition-colors cursor-pointer shadow-sm"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Start Practice</span>
          </button>
          <button
            onClick={() => onNavigate('revision-centre')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition-colors cursor-pointer border border-neutral-700/60"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Revision Queue</span>
            {metrics && metrics.revision_due_count > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-semibold border border-indigo-500/30">
                {metrics.revision_due_count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Primary Dashboard Metrics Grid (9 required metrics clearly displayed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* 1. Total Questions in Library */}
        <StatWidget
          label="Total Questions"
          value={metrics?.total_questions_in_library ?? (stats?.total_questions || 0)}
          subValue="Available in bank"
          icon={HelpCircle}
          badge="Library"
          badgeVariant="neutral"
        />

        {/* 2. Unique Questions Attempted */}
        <StatWidget
          label="Unique Attempted"
          value={metrics?.unique_questions_attempted ?? 0}
          subValue="Distinct questions completed"
          icon={CheckCircle2}
          badge={
            metrics && metrics.total_questions_in_library > 0
              ? `${Math.round((metrics.unique_questions_attempted / metrics.total_questions_in_library) * 100)}% coverage`
              : '0%'
          }
          badgeVariant="success"
        />

        {/* 3. Unique Questions Remaining */}
        <StatWidget
          label="Unique Remaining"
          value={metrics?.unique_questions_remaining ?? (stats?.total_questions || 0)}
          subValue="Unattempted questions"
          icon={Layers}
          badge="Unpracticed"
          badgeVariant="neutral"
        />

        {/* 4. Total Attempts (Distinguished from Unique Questions) */}
        <StatWidget
          label="Total Attempts"
          value={metrics?.total_attempts ?? 0}
          subValue="Cumulative drill + revision runs"
          icon={TrendingUp}
          badge="Attempts"
          badgeVariant="neutral"
        />

        {/* 5. Overall Accuracy */}
        <StatWidget
          label="Overall Accuracy"
          value={metrics ? `${metrics.overall_accuracy}%` : '—'}
          subValue="Performance across all attempts"
          icon={Percent}
          badge={metrics && metrics.overall_accuracy >= 70 ? 'Strong' : 'Tracking'}
          badgeVariant={metrics && metrics.overall_accuracy >= 70 ? 'success' : 'neutral'}
        />

        {/* 6. Today's Study Time */}
        <StatWidget
          label="Today's Active Time"
          value={formatTimeHHMMSS(effectiveTodaySeconds)}
          subValue={`Target: ${formatDurationHuman(dailyHourTargetSec)}`}
          icon={Clock}
          badge={`${hourProgressPct}%`}
          badgeVariant={hourProgressPct >= 100 ? 'success' : 'neutral'}
        />

        {/* 7. Weekly Study Time */}
        <StatWidget
          label="Weekly Study Time"
          value={formatDurationHuman(metrics?.weekly_study_time_seconds || 0)}
          subValue="Past 7 days active focus"
          icon={Calendar}
          badge="7-Day"
          badgeVariant="neutral"
        />

        {/* 8. Total Active Study Time */}
        <StatWidget
          label="Total Active Time"
          value={formatDurationHuman(metrics?.total_active_study_time_seconds || effectiveTodaySeconds)}
          subValue="All-time active focus stopwatch"
          icon={Clock}
          badge="Cumulative"
          badgeVariant="neutral"
        />

        {/* 9. Revision Questions Due */}
        <StatWidget
          label="Revision Due"
          value={metrics?.revision_due_count ?? 0}
          subValue="Spaced repetition due today"
          icon={RotateCw}
          badge={metrics && metrics.revision_due_count > 0 ? 'Due Now' : 'Clear'}
          badgeVariant={metrics && metrics.revision_due_count > 0 ? 'warning' : 'success'}
        />

        {/* Actionable Recommender Trigger */}
        <div
          onClick={() => onNavigate('analytics')}
          className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Preparation Intelligence</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-1">
            <span className="text-lg font-semibold text-white">
              {recs.length} Action{recs.length === 1 ? '' : 's'}
            </span>
            <p className="text-[11px] text-neutral-500 mt-0.5">Recommendations ready</p>
          </div>
          <span className="text-xs text-indigo-400 flex items-center gap-1 font-medium">
            View Analytics <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Target Progress & Intelligence Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Study Goals Progress */}
        <Card
          title="Daily Study Goals"
          subtitle="Real-time progress toward your daily target thresholds"
          className="lg:col-span-1"
          action={
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Configure Goals →
            </button>
          }
        >
          <div className="space-y-4">
            {/* Study Time Progress */}
            <div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-neutral-400">Daily Study Hours</span>
                <span className="font-mono text-neutral-200">
                  {formatDurationHuman(effectiveTodaySeconds)} / {goals?.daily_hours_target || 2}h ({hourProgressPct}%)
                </span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-neutral-200 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${hourProgressPct}%` }}
                />
              </div>
            </div>

            {/* Questions Target Progress */}
            <div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-neutral-400">Daily Questions</span>
                <span className="font-mono text-neutral-200">
                  {todayQCount} / {dailyQTarget} ({qProgressPct}%)
                </span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${qProgressPct}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Paused time excluded from active tracking</span>
              <span className="font-mono text-neutral-400">Clean Focus</span>
            </div>
          </div>
        </Card>

        {/* Preparation Intelligence Recommendations */}
        <Card
          title="Preparation Intelligence"
          subtitle="Data-driven suggestions derived from your actual accuracy and retention"
          className="lg:col-span-2"
          action={
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Full Report →
            </button>
          }
        >
          {recs.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500 space-y-1">
              <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-500/70 mb-2" />
              <p className="font-medium text-neutral-300">All systems optimal!</p>
              <p className="text-[11px] text-neutral-500">
                Attempt more practice drills to generate weak-area diagnostics and pacing recommendations.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recs.slice(0, 3).map((rec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-950/60 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border ${
                          rec.priority === 'high'
                            ? 'bg-red-950/60 text-red-300 border-red-800/60'
                            : rec.priority === 'medium'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <h4 className="text-xs font-medium text-white">{rec.title}</h4>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-snug">{rec.description}</p>
                  </div>
                  <button
                    onClick={() => onNavigate(rec.target_section)}
                    className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                  >
                    Action →
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Subject Distribution */}
      <Card
        title="Question Bank by Subject"
        subtitle="Current distribution across your uploaded SSC exam papers"
        action={
          <button
            onClick={() => onNavigate('question-library')}
            className="text-xs font-mono text-neutral-400 hover:text-white"
          >
            View Question Library →
          </button>
        }
      >
        {stats && Object.keys(stats.by_subject).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
            {Object.entries(stats.by_subject).map(([subj, count]) => (
              <div
                key={subj}
                className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1"
              >
                <p className="text-[11px] text-neutral-400 truncate">{subj}</p>
                <p className="text-lg font-semibold font-mono text-white">{count}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-lg bg-neutral-800/50 flex items-center justify-center text-neutral-500 mb-2.5">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-neutral-300">
              No questions categorized yet
            </p>
            <p className="text-[11px] text-neutral-500 max-w-sm mt-1">
              Upload PDFs in the Import Centre to automatically segment and categorize questions into Quantitative Aptitude, Reasoning, English, and General Studies.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
