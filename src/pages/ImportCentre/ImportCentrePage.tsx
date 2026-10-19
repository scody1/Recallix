import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  StopCircle,
  FileCheck,
  Cpu,
  Layers,
  Terminal,
  Clock,
  Copy,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api } from '../../services/api';
import { ImportJob, ProcessingLog } from '../../types';

export const ImportCentrePage: React.FC = () => {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<any[]>([]);
  const [selectedJobLogs, setSelectedJobLogs] = useState<{ job: ImportJob; logs: ProcessingLog[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchJobs = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (err) {
      console.warn('Failed to fetch jobs', err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (pdfFiles.length === 0) {
      alert('Please select valid PDF documents.');
      return;
    }

    setIsUploading(true);
    setUploadFeedback([]);
    try {
      const res = await api.uploadPDFs(pdfFiles);
      setUploadFeedback(res.uploaded || []);
      await fetchJobs();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.cancelJob(jobId);
      await fetchJobs();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message}`);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.retryJob(jobId);
      await fetchJobs();
    } catch (err: any) {
      alert(`Failed to retry job: ${err.message}`);
    }
  };

  const handleViewLogs = async (jobId: string) => {
    try {
      const details = await api.getJob(jobId);
      setSelectedJobLogs(details);
    } catch (err: any) {
      alert(`Failed to fetch logs: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 flex items-start gap-3">
        <Cpu className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs text-neutral-400 space-y-1">
          <p className="text-neutral-200 font-medium">Bulk PDF Ingestion Engine Active</p>
          <p>
            Local extraction powered by PyMuPDF and Tesseract OCR preprocessing. Structured question extraction, multi-page spanning reconciliation, and answer key association run as non-blocking background workers.
          </p>
        </div>
      </div>

      {/* Multiple PDF Upload Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
          isUploading
            ? 'border-neutral-600 bg-neutral-900/40'
            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/20 hover:bg-neutral-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="w-12 h-12 rounded-xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-neutral-300 mb-3 shadow-sm">
          <UploadCloud className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
        </div>
        <h3 className="text-sm font-semibold text-neutral-100 mb-1">
          {isUploading ? 'Uploading & Enqueuing Documents...' : 'Drop PDF Documents or Click to Browse'}
        </h3>
        <p className="text-xs text-neutral-400 max-w-md mb-3">
          Select single or batch PDFs (e.g. 50–500 pages per file, up to 3,000–4,000 pages total). Duplicate files are detected via SHA256 checksums automatically.
        </p>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
          Supports: Text-based PDFs • Scanned PDFs • SSC Past Papers • Separate Answer Keys
        </span>
      </div>

      {/* Immediate Upload Feedback (e.g. Duplicate Detection Notice) */}
      {uploadFeedback.length > 0 && (
        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-2">
          <h4 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            Upload Summary
          </h4>
          <div className="space-y-1.5 text-xs">
            {uploadFeedback.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-neutral-950 border border-neutral-800/80"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-neutral-200 font-medium">{item.filename}</span>
                </div>
                {item.is_duplicate ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                    <Copy className="w-3 h-3" /> Duplicate File (SHA256 Match)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" /> Enqueued ({item.total_pages} Pages)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Background Processing Jobs List */}
      <Card
        title="Ingestion Queue & Processing Jobs"
        subtitle="Recoverable background workers executing chunked page extraction"
        action={
          <button
            onClick={fetchJobs}
            className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Refresh
          </button>
        }
      >
        {jobs.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            No ingestion jobs recorded yet. Upload a PDF above to begin background extraction.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const progressPct =
                job.total_pages > 0
                  ? Math.min(100, Math.round((job.processed_pages / job.total_pages) * 100))
                  : job.status === 'completed'
                  ? 100
                  : 0;

              return (
                <div
                  key={job.id}
                  className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span className="text-xs font-semibold text-neutral-200 truncate">
                        {job.pdf_filename || `Document ${job.pdf_id.slice(0, 8)}...`}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                          job.status === 'completed'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                            : job.status === 'processing'
                            ? 'bg-blue-950/40 text-blue-400 border-blue-800/40 animate-pulse'
                            : job.status === 'cancelled'
                            ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          job.status === 'completed'
                            ? 'bg-emerald-500'
                            : job.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-400 pt-1">
                      <span>
                        Pages: {job.processed_pages} / {job.total_pages} ({progressPct}%)
                      </span>
                      <span>•</span>
                      <span>Questions Extracted: {job.extracted_questions}</span>
                      {job.ocr_pages_count > 0 && (
                        <>
                          <span>•</span>
                          <span>OCR Pages: {job.ocr_pages_count}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions & Logs */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleViewLogs(job.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Terminal className="w-3 h-3 text-neutral-400" />
                      <span>Logs</span>
                    </button>

                    {job.status === 'processing' && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-rose-400 text-xs font-medium border border-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Cancel Processing"
                      >
                        <StopCircle className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        onClick={() => handleRetryJob(job.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Retry Ingestion"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Processing Logs Modal */}
      {selectedJobLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="h-12 px-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <span className="font-mono text-xs font-medium text-neutral-200 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                Job Logs: {selectedJobLogs.job.id}
              </span>
              <button
                onClick={() => setSelectedJobLogs(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1.5 bg-black/60">
              {selectedJobLogs.logs.length === 0 ? (
                <p className="text-neutral-500">No log entries available.</p>
              ) : (
                selectedJobLogs.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-neutral-300">
                    <span className="text-neutral-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`px-1 rounded text-[10px] shrink-0 ${
                        log.level === 'ERROR'
                          ? 'bg-rose-950 text-rose-400'
                          : log.level === 'WARN'
                          ? 'bg-amber-950 text-amber-400'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-neutral-300 break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
