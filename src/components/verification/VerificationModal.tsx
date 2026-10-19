import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Copy,
  Layers,
  Save,
} from 'lucide-react';
import { ExtractedQuestion, OptionItem, SubjectCategory, VerificationStatus } from '../../types';
import { api } from '../../services/api';

interface VerificationModalProps {
  question: ExtractedQuestion;
  onClose: () => void;
  onSaved: (updated: ExtractedQuestion) => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  question,
  onClose,
  onSaved,
}) => {
  const [questionText, setQuestionText] = useState(question.question_text);
  const [options, setOptions] = useState<OptionItem[]>(
    Array.isArray(question.options) ? [...question.options] : []
  );
  const [correctAnswer, setCorrectAnswer] = useState<string>(question.correct_answer || '');
  const [subject, setSubject] = useState<string>(question.subject || '');
  const [topic, setTopic] = useState<string>(question.topic || '');
  const [status, setStatus] = useState<VerificationStatus>(question.verification_status);
  const [explanation, setExplanation] = useState<string>(question.explanation || '');

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReprocessing, setIsReprocessing] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Original page image URL served by backend
  const pageImageUrl = question.page_image_url
    ? `http://127.0.0.1:8000${question.page_image_url}`
    : null;

  const handleOptionTextChange = (index: number, newText: string) => {
    const updated = [...options];
    updated[index].text = newText;
    setOptions(updated);
  };

  const handleAddOption = () => {
    const nextLabel = String.fromCharCode(65 + options.length); // E, F...
    setOptions([...options, { label: nextLabel, text: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSave = async (customStatus?: VerificationStatus) => {
    setIsSaving(true);
    setNotice(null);
    try {
      const finalStatus = customStatus || status;
      const updated = await api.updateQuestion(question.id, {
        question_text: questionText,
        options,
        correct_answer: correctAnswer || null,
        explanation: explanation || null,
        subject: subject || null,
        topic: topic || null,
        verification_status: finalStatus,
      });
      setStatus(finalStatus);
      onSaved(updated);
      setNotice('Changes saved to SQLite database.');
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setNotice(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    setNotice(null);
    try {
      const res = await api.reprocessPage(question.id);
      setNotice(`Page reprocessed. Text extracted (${res.reprocessed_text ? res.reprocessed_text.length : 0} chars).`);
    } catch (err: any) {
      setNotice(`Reprocess failed: ${err.message}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-hidden">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="h-14 px-6 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
              Q.{question.raw_question_number || question.id.slice(0, 8)}
            </span>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <FileText className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-neutral-300 font-medium">{question.source_filename}</span>
              <span>•</span>
              <span>
                Page {question.page_number}
                {question.page_end_number > question.page_number && `–${question.page_end_number}`}
              </span>
            </div>
            {question.is_duplicate === 1 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40">
                <Copy className="w-3 h-3" /> Duplicate Detected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {notice && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/40">
                {notice}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Side-by-Side Verification Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Original PDF Page Visual Snapshot */}
          <div className="w-1/2 border-r border-neutral-800 flex flex-col bg-neutral-950/40">
            {/* Image Toolbar */}
            <div className="h-10 px-4 border-b border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 bg-neutral-950/80">
              <span className="flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-neutral-500" />
                Original Document Page {question.page_number}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="Reset Zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Canvas */}
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-neutral-950/90">
              {pageImageUrl ? (
                <div
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="shadow-xl rounded border border-neutral-800 overflow-hidden bg-white max-w-full"
                >
                  <img
                    src={pageImageUrl}
                    alt={`Original PDF Page ${question.page_number}`}
                    className="block max-w-full h-auto select-none pointer-events-none"
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No page snapshot rendered</p>
                  <p className="text-[11px] text-neutral-600 mt-1">
                    Click 'Reprocess Page' below to generate snapshot
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Reprocess Bar */}
            <div className="h-11 px-4 border-t border-neutral-800 flex items-center justify-between text-xs bg-neutral-950/60">
              <span className="text-neutral-500 font-mono text-[11px]">
                Extraction Confidence: {Math.round(question.confidence * 100)}%
              </span>
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3 h-3 ${isReprocessing ? 'animate-spin' : ''}`} />
                <span>Reprocess Page</span>
              </button>
            </div>
          </div>

          {/* Right Pane: Structured Question Editor */}
          <div className="w-1/2 flex flex-col bg-neutral-900/50">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Question Text */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-1.5">
                  Question Text
                </label>
                <textarea
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 font-sans leading-relaxed"
                  placeholder="Enter or correct question stem..."
                />
              </div>

              {/* Options Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Answer Options
                  </label>
                  <button
                    onClick={handleAddOption}
                    className="text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {options.map((opt, idx) => {
                    const isCorrect = correctAnswer === opt.label;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          isCorrect
                            ? 'bg-emerald-950/20 border-emerald-800/60'
                            : 'bg-neutral-950 border-neutral-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCorrectAnswer(isCorrect ? '' : opt.label)}
                          className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-semibold cursor-pointer transition-colors ${
                            isCorrect
                              ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                          }`}
                          title={isCorrect ? 'Correct Answer' : 'Click to set as correct answer'}
                        >
                          {opt.label}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          className="flex-1 bg-transparent border-none text-xs text-neutral-200 focus:outline-none"
                          placeholder={`Option ${opt.label} text...`}
                        />
                        <button
                          onClick={() => handleRemoveOption(idx)}
                          className="text-neutral-600 hover:text-neutral-400 p-1"
                          title="Remove Option"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Click on an option badge (A, B, C, D) to toggle it as the verified correct answer.
                </p>
              </div>

              {/* Subject & Topic Classification */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-1.5">
                    Subject Classification
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
                  >
                    <option value="">Uncategorised</option>
                    <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="English">English</option>
                    <option value="General Studies">General Studies</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-1.5">
                    Topic / Sub-topic
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Geometry, Analogy, Polity"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              {/* Verification Status Selector */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2">
                  Verification Status
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('unverified')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                      status === 'unverified'
                        ? 'bg-neutral-800 text-white border-neutral-600'
                        : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Unverified</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('verified')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                      status === 'verified'
                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-600'
                        : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('flagged')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                      status === 'flagged'
                        ? 'bg-amber-950/50 text-amber-300 border-amber-600'
                        : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Flagged</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('incomplete')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                      status === 'incomplete'
                        ? 'bg-neutral-800 text-neutral-300 border-neutral-500'
                        : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Incomplete</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="h-16 px-6 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave('verified')}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Verified & Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('flagged')}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-medium text-xs transition-colors cursor-pointer border border-neutral-700"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Flag</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 text-xs font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 font-medium text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
