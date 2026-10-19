import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Copy,
  ChevronLeft,
  ChevronRight,
  Layers,
  Edit3,
  Eye,
} from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { VerificationModal } from '../../components/verification/VerificationModal';
import { MathFormattedText } from '../../components/common/MathFormattedText';
import { PdfPageModal } from '../../components/common/PdfPageModal';
import { api } from '../../services/api';
import { ExtractedQuestion, NavSection } from '../../types';

interface QuestionLibraryPageProps {
  onNavigate: (section: NavSection) => void;
}

export const QuestionLibraryPage: React.FC<QuestionLibraryPageProps> = ({
  onNavigate,
}) => {
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAttemptStatus, setSelectedAttemptStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const PAGE_SIZE = 20;

  // Selected question for Verification modal & PDF Page modal
  const [verifyingQuestion, setVerifyingQuestion] = useState<ExtractedQuestion | null>(null);
  const [viewingPdfQuestion, setViewingPdfQuestion] = useState<ExtractedQuestion | null>(null);

  // Load PDF documents list for PDF filter
  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs);
      } catch (err) {
        console.warn('Failed to load documents', err);
      }
    }
    loadDocs();
  }, []);

  // Load topics when subject changes
  useEffect(() => {
    async function loadTopics() {
      try {
        const tList = await api.getPracticeTopics(selectedSubject);
        setTopics(tList);
        setSelectedTopic('all');
      } catch (err) {
        console.warn('Failed to load topics', err);
      }
    }
    loadTopics();
  }, [selectedSubject]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const res = await api.getQuestions({
        pdf_id: selectedPdf !== 'all' ? selectedPdf : undefined,
        subject: selectedSubject !== 'all' ? selectedSubject : undefined,
        topic: selectedTopic !== 'all' ? selectedTopic : undefined,
        verification_status: selectedStatus !== 'all' ? selectedStatus : undefined,
        attempt_status: selectedAttemptStatus !== 'all' ? selectedAttemptStatus : undefined,
        search: searchQuery.trim() || undefined,
        is_duplicate: showDuplicatesOnly ? true : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setQuestions(res.items);
      setTotalCount(res.total);
    } catch (err) {
      console.warn('Failed to fetch questions', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [selectedPdf, selectedSubject, selectedTopic, selectedStatus, selectedAttemptStatus, showDuplicatesOnly, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchQuestions();
  };

  const handleQuestionSaved = (updated: ExtractedQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setVerifyingQuestion(updated);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col gap-3">
        {/* Row 1: Search & PDF & Attempt Filter */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search text, numbers, formulas..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
            />
          </form>

          {/* PDF Source Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end text-xs">
            <select
              value={selectedPdf}
              onChange={(e) => {
                setSelectedPdf(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 focus:outline-none focus:border-neutral-700 max-w-[200px] truncate"
              title="Filter by PDF Document"
            >
              <option value="all">All PDF Documents</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>

            {/* Attempt Status Filter */}
            <select
              value={selectedAttemptStatus}
              onChange={(e) => {
                setSelectedAttemptStatus(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 focus:outline-none focus:border-neutral-700"
            >
              <option value="all">All Attempt States</option>
              <option value="unattempted">Unattempted Only</option>
              <option value="incorrect">Incorrect Only</option>
              <option value="attempted">Attempted</option>
            </select>
          </div>
        </div>

        {/* Row 2: Subject, Topic, Verification Status & Duplicate Toggle */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-neutral-800/60">
          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Subjects</option>
            <option value="Quantitative Aptitude">Quantitative Aptitude</option>
            <option value="Reasoning">Reasoning</option>
            <option value="English">English</option>
            <option value="General Studies">General Studies</option>
            <option value="uncategorised">Uncategorised</option>
          </select>

          {/* Topic Filter */}
          {topics.length > 0 && (
            <select
              value={selectedTopic}
              onChange={(e) => {
                setSelectedTopic(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 focus:outline-none focus:border-neutral-700 max-w-[180px] truncate"
            >
              <option value="all">All Topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Verification Statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="requires_correction">Requires Correction (Flagged)</option>
            <option value="unavailable_answer">Unavailable Answer (Incomplete)</option>
          </select>

          {/* Duplicates Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowDuplicatesOnly(!showDuplicatesOnly);
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-lg border font-mono text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ml-auto ${
              showDuplicatesOnly
                ? 'bg-amber-950/40 text-amber-400 border-amber-800/50'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            <Copy className="w-3 h-3" />
            <span>Duplicate Candidates</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-neutral-500 font-mono">
          Loading question repository...
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Questions Matching Criteria"
          description="Either the library is currently empty or no questions matched your current filter criteria."
          phaseNote="Import new PDFs via the Import Centre to populate the repository"
          actionText="Go to Import Centre"
          onAction={() => onNavigate('import-centre')}
        />
      ) : (
        <div className="space-y-4">
          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono px-1">
            <span>
              Showing {questions.length} of {totalCount} Questions
            </span>
            <span>
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
          </div>

          {/* Question Cards List */}
          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:border-neutral-700/80 transition-colors space-y-3"
              >
                {/* Question Header & Traceability Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                      Q.{q.raw_question_number || '—'}
                    </span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="font-medium text-neutral-300">{q.source_filename}</span>
                    </span>

                    {/* Direct PDF Page Button */}
                    {q.page_image_url && (
                      <button
                        onClick={() => setViewingPdfQuestion(q)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 text-[11px] font-mono transition-colors cursor-pointer"
                        title="Open original scanned PDF page"
                      >
                        <Eye className="w-3 h-3 text-neutral-400" />
                        <span>p.{q.page_number}{q.page_end_number > q.page_number && `–${q.page_end_number}`}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Subject / Topic Pill */}
                    {q.subject && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {q.subject} {q.topic && `• ${q.topic}`}
                      </span>
                    )}

                    {/* Duplicate Indicator */}
                    {q.is_duplicate === 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40">
                        <Copy className="w-3 h-3" /> Duplicate
                      </span>
                    )}

                    {/* Verification Status Pill */}
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border capitalize flex items-center gap-1 ${
                        q.verification_status === 'verified'
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                          : q.verification_status === 'flagged' || q.verification_status === 'requires_correction'
                          ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                          : q.verification_status === 'incomplete' || q.verification_status === 'unavailable_answer'
                          ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      {q.verification_status === 'verified' && <CheckCircle2 className="w-3 h-3" />}
                      {(q.verification_status === 'flagged' || q.verification_status === 'requires_correction') && (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {q.verification_status === 'flagged'
                        ? 'Requires Correction'
                        : q.verification_status === 'incomplete'
                        ? 'Unavailable Answer'
                        : q.verification_status}
                    </span>

                    {/* Verify & Edit Button */}
                    <button
                      onClick={() => setVerifyingQuestion(q)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Verify & Edit</span>
                    </button>
                  </div>
                </div>

                {/* Question Stem Text with Math formatting */}
                <div className="text-xs text-neutral-100 font-sans leading-relaxed">
                  <MathFormattedText text={q.question_text} />
                </div>

                {/* Options Grid */}
                {Array.isArray(q.options) && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = q.correct_answer === opt.label;
                      return (
                        <div
                          key={oIdx}
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs border ${
                            isCorrect
                              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                              : 'bg-neutral-950/80 border-neutral-800/70 text-neutral-300'
                          }`}
                        >
                          <span
                            className={`font-mono text-[11px] font-semibold w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-500 text-neutral-950'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="leading-tight flex-1">
                            <MathFormattedText text={opt.text} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="font-mono text-xs text-neutral-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Verification & Edit Modal */}
      {verifyingQuestion && (
        <VerificationModal
          question={verifyingQuestion}
          onClose={() => setVerifyingQuestion(null)}
          onSaved={handleQuestionSaved}
        />
      )}

      {/* Original PDF Page Snapshot Modal */}
      {viewingPdfQuestion && (
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
