import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Clock,
  Shuffle,
  Shield,
  Layers,
  FileText,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
} from 'lucide-react';
import { Card } from '../common/Card';
import { QuestionPool, PracticeMode, PracticeConfig } from '../../types';
import { api } from '../../services/api';

interface PracticeSetupProps {
  onStartSession: (config: PracticeConfig) => void;
  onResumeSession: () => void;
  hasActiveSession: boolean;
}

export const PracticeSetup: React.FC<PracticeSetupProps> = ({
  onStartSession,
  onResumeSession,
  hasActiveSession,
}) => {
  // Default configuration: Entire question library, all subjects, all remaining unattempted questions
  const [pool, setPool] = useState<QuestionPool>('all_unattempted');
  const [pdfId, setPdfId] = useState<string>('');
  const [subject, setSubject] = useState<string>('all');
  const [topic, setTopic] = useState<string>('all');
  const [count, setCount] = useState<number | 'all'>(10);
  const [mode, setMode] = useState<PracticeMode>('untimed');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(false);
  const [includeUnverified, setIncludeUnverified] = useState<boolean>(false);
  const [reviewMode, setReviewMode] = useState<boolean>(false);
  const [correctMarks, setCorrectMarks] = useState<number>(2.0);
  const [negativeMarks, setNegativeMarks] = useState<number>(0.5);

  const [documents, setDocuments] = useState<any[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs);
      } catch (err) {
        console.warn('Failed to load documents', err);
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    async function loadTopics() {
      try {
        const tList = await api.getPracticeTopics(subject);
        setTopics(tList);
        setTopic('all');
      } catch (err) {
        console.warn('Failed to load topics', err);
      }
    }
    loadTopics();
  }, [subject]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    const config: PracticeConfig = {
      pool,
      pdf_id: pool === 'specific_pdf' ? pdfId || undefined : undefined,
      subject: subject !== 'all' ? subject : undefined,
      topic: topic !== 'all' ? topic : undefined,
      count,
      mode,
      duration_minutes: durationMinutes,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      include_unverified: includeUnverified,
      review_mode: reviewMode,
      correct_marks: correctMarks,
      negative_marks: negativeMarks,
    };

    onStartSession(config);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Resume In-Progress Banner */}
      {hasActiveSession && (
        <div className="p-4 rounded-xl border border-blue-800/80 bg-blue-950/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-900/60 border border-blue-700/60 flex items-center justify-center text-blue-300">
              <RotateCcw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200">
                Unfinished Practice Session Detected
              </p>
              <p className="text-[11px] text-blue-400">
                You have an active test session saved. Resume where you left off or configure a new drill.
              </p>
            </div>
          </div>
          <button
            onClick={onResumeSession}
            className="px-3.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-neutral-950 font-medium text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            Resume Test
          </button>
        </div>
      )}

      {/* Main Configuration Card */}
      <Card
        title="Custom Practice Engine Configuration"
        subtitle="Practice questions from your uploaded PDFs. No exam selection forced."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorNotice && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* 1. Question Pool Selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2">
              1. Question Pool
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { id: 'all_unattempted', label: 'Unattempted Questions', desc: 'Questions not yet answered (Default)' },
                { id: 'entire', label: 'Entire Question Library', desc: 'All questions in local repository' },
                { id: 'specific_pdf', label: 'Specific PDF Document', desc: 'Limit drill to one imported source' },
                { id: 'incorrect', label: 'Previously Incorrect', desc: 'Target weak spots & mistake log' },
                { id: 'bookmarked', label: 'Bookmarked Questions', desc: 'Reinforce saved challenge items' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setPool(item.id as QuestionPool)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    pool === item.id
                      ? 'bg-neutral-800 text-white border-neutral-600 shadow-sm'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>

            {/* Document Selector if specific_pdf chosen */}
            {pool === 'specific_pdf' && (
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Select Source Document:
                </label>
                <select
                  value={pdfId}
                  onChange={(e) => setPdfId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
                >
                  <option value="">-- Choose an uploaded PDF --</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename} ({doc.total_pages} pages)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2 & 3. Optional Subject & Topic Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-800/60">
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-1.5">
                2. Subject Filter (Optional)
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
              >
                <option value="all">All Subjects (No Filter)</option>
                <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                <option value="Reasoning">Reasoning</option>
                <option value="English">English</option>
                <option value="General Studies">General Studies</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-1.5">
                3. Topic Filter (Optional)
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
              >
                <option value="all">All Topics (No Filter)</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 & 5. Number of Questions & Practice Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-neutral-800/60">
            {/* Number of Questions */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2">
                4. Number of Questions
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[10, 25, 50, 100, 'all'].map((val) => (
                  <button
                    type="button"
                    key={String(val)}
                    onClick={() => setCount(val as any)}
                    className={`h-9 rounded-lg text-xs font-mono font-medium border flex items-center justify-center cursor-pointer transition-colors ${
                      count === val
                        ? 'bg-neutral-800 text-white border-neutral-600'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                    }`}
                  >
                    {val === 'all' ? 'All' : val}
                  </button>
                ))}
              </div>
            </div>

            {/* Practice Mode */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2">
                5. Practice Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'untimed', label: 'Untimed', desc: 'Elapsed only' },
                  { id: 'timed', label: 'Timed', desc: 'Countdown & pause' },
                  { id: 'strict', label: 'Strict Simulation', desc: 'No pause, auto-submit' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setMode(item.id as PracticeMode)}
                    className={`p-2 rounded-lg text-xs border text-center transition-colors cursor-pointer ${
                      mode === item.id
                        ? 'bg-neutral-800 text-white border-neutral-600'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                    }`}
                  >
                    <p className="font-semibold text-[11px]">{item.label}</p>
                    <p className="text-[10px] text-neutral-500">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Duration for Timed Sessions */}
          {mode !== 'untimed' && (
            <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs text-neutral-300">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span>Test Duration (Minutes):</span>
              </div>
              <div className="flex items-center gap-2">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    type="button"
                    key={mins}
                    onClick={() => setDurationMinutes(mins)}
                    className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                      durationMinutes === mins
                        ? 'bg-neutral-800 text-white border-neutral-600'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)}
                  className="w-16 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-200 text-center"
                />
              </div>
            </div>
          )}

          {/* 7 & 8. Advanced Toggles & Marking Scheme */}
          <div className="pt-2 border-t border-neutral-800/60 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-white"
                />
                <span className="text-xs text-neutral-300">Shuffle Questions</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-white"
                />
                <span className="text-xs text-neutral-300">Shuffle Options</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnverified}
                  onChange={(e) => setIncludeUnverified(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-white"
                />
                <span className="text-xs text-neutral-300">Allow Unverified</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewMode}
                  onChange={(e) => setReviewMode(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-blue-400"
                />
                <span className="text-xs text-blue-200">Immediate Review</span>
              </label>
            </div>

            {/* Configurable Marking Scheme */}
            <div className="p-3 rounded-lg bg-neutral-950/40 border border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5 font-medium text-neutral-300">
                <Award className="w-3.5 h-3.5 text-neutral-400" />
                Configurable Marking Scheme:
              </span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1">
                  Correct:
                  <input
                    type="number"
                    step="0.25"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(parseFloat(e.target.value) || 2.0)}
                    className="w-12 px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-emerald-400 text-center"
                  />
                </span>
                <span className="flex items-center gap-1">
                  Negative:
                  <input
                    type="number"
                    step="0.25"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0.5)}
                    className="w-12 px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-rose-400 text-center"
                  />
                </span>
              </div>
            </div>
          </div>

          {/* Launch Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 font-semibold text-xs transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Practice Session</span>
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};
