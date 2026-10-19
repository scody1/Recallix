import { ExtractedQuestion, ImportJob, ProcessingLog, SystemStats, RevisionItem, RevisionStats, RevisionFilterType, AnalyticsOverview, StudySession } from '../types';

export const BACKEND_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://127.0.0.1:8000';
const API_BASE = `${BACKEND_BASE}/api`;

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async uploadPDFs(files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload PDFs');
    return res.json();
  },

  async getJobs(): Promise<ImportJob[]> {
    const res = await fetch(`${API_BASE}/jobs`);
    if (!res.ok) throw new Error('Failed to fetch jobs');
    return res.json();
  },

  async getJob(jobId: string): Promise<{ job: ImportJob; logs: ProcessingLog[] }> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error('Failed to fetch job');
    return res.json();
  },

  async cancelJob(jobId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to cancel job');
    return res.json();
  },

  async retryJob(jobId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to retry job');
    return res.json();
  },

  async getQuestions(params: {
    pdf_id?: string;
    subject?: string;
    topic?: string;
    verification_status?: string;
    attempt_status?: string;
    search?: string;
    is_duplicate?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; limit: number; offset: number; items: ExtractedQuestion[] }> {
    const query = new URLSearchParams();
    if (params.pdf_id && params.pdf_id !== 'all') query.append('pdf_id', params.pdf_id);
    if (params.subject && params.subject !== 'all') query.append('subject', params.subject);
    if (params.topic && params.topic !== 'all') query.append('topic', params.topic);
    if (params.verification_status && params.verification_status !== 'all') {
      query.append('verification_status', params.verification_status);
    }
    if (params.attempt_status && params.attempt_status !== 'all') {
      query.append('attempt_status', params.attempt_status);
    }
    if (params.search) query.append('search', params.search);
    if (params.is_duplicate !== undefined) query.append('is_duplicate', String(params.is_duplicate));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.offset) query.append('offset', String(params.offset));

    const res = await fetch(`${API_BASE}/questions?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch questions');
    return res.json();
  },

  async getQuestion(id: string): Promise<ExtractedQuestion> {
    const res = await fetch(`${API_BASE}/questions/${id}`);
    if (!res.ok) throw new Error('Failed to fetch question');
    return res.json();
  },

  async updateQuestion(id: string, updates: Partial<ExtractedQuestion>): Promise<ExtractedQuestion> {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update question');
    return res.json();
  },

  async reprocessPage(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/questions/${id}/reprocess-page`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reprocess page');
    return res.json();
  },

  // --- Phase 3 Practice Engine ---

  async getDocuments(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getPracticeTopics(subject?: string): Promise<string[]> {
    const url = subject && subject !== 'all'
      ? `${API_BASE}/practice/topics?subject=${encodeURIComponent(subject)}`
      : `${API_BASE}/practice/topics`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch topics');
    const data = await res.json();
    return data.topics || [];
  },

  async toggleBookmark(questionId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/practice/bookmarks/${questionId}/toggle`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to toggle bookmark');
    const data = await res.json();
    return data.is_bookmarked;
  },

  async getBookmarks(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/practice/bookmarks`);
    if (!res.ok) throw new Error('Failed to fetch bookmarks');
    const data = await res.json();
    return data.bookmarked_ids || [];
  },

  async createPracticeSession(config: any): Promise<any> {
    const res = await fetch(`${API_BASE}/practice/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create practice session');
    }
    return res.json();
  },

  async getActivePracticeSession(): Promise<any> {
    const res = await fetch(`${API_BASE}/practice/sessions/active`);
    if (!res.ok) throw new Error('Failed to check active practice session');
    const data = await res.json();
    return data.active_session;
  },

  async getPracticeSession(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/practice/sessions/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch practice session');
    return res.json();
  },

  async savePracticeProgress(sessionId: string, payload: {
    current_index: number;
    elapsed_seconds: number;
    attempts: any[];
  }): Promise<void> {
    await fetch(`${API_BASE}/practice/sessions/${sessionId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async submitPracticeSession(sessionId: string, payload: {
    elapsed_seconds: number;
    attempts?: any[];
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/practice/sessions/${sessionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to submit practice session');
    }
    return res.json();
  },

  async abandonPracticeSession(sessionId: string): Promise<void> {
    await fetch(`${API_BASE}/practice/sessions/${sessionId}/abandon`, {
      method: 'POST',
    });
  },

  // --- Phase 4: Smart Revision & Mistake Tracker ---
  async getRevisionStats(): Promise<RevisionStats> {
    const res = await fetch(`${API_BASE}/revision/stats`);
    if (!res.ok) throw new Error('Failed to fetch revision stats');
    return res.json();
  },

  async getRevisionItems(params: {
    filter_type: RevisionFilterType;
    subject?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; limit: number; offset: number; items: RevisionItem[] }> {
    const query = new URLSearchParams();
    query.set('filter_type', params.filter_type);
    if (params.subject && params.subject !== 'all') query.set('subject', params.subject);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    const res = await fetch(`${API_BASE}/revision/items?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch revision items');
    return res.json();
  },

  async recordRevisionReattempt(payload: {
    question_id: string;
    selected_option: string;
    mistake_category?: string;
    is_difficult?: boolean;
    notes?: string;
  }): Promise<{ is_correct: number; correct_answer?: string; item?: RevisionItem }> {
    const res = await fetch(`${API_BASE}/revision/reattempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to record re-attempt');
    return res.json();
  },

  async classifyMistake(questionId: string, mistakeCategory: string): Promise<void> {
    const res = await fetch(`${API_BASE}/revision/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, mistake_category: mistakeCategory }),
    });
    if (!res.ok) throw new Error('Failed to classify mistake');
  },

  async toggleRevisionDifficult(questionId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/revision/toggle-difficult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId }),
    });
    if (!res.ok) throw new Error('Failed to toggle difficult status');
    const data = await res.json();
    return data.is_difficult;
  },

  // --- Phase 5: Analytics & Preparation Intelligence ---
  async getAnalyticsOverview(params?: {
    date_range?: string;
    start_date?: string;
    end_date?: string;
    subject?: string;
  }): Promise<AnalyticsOverview> {
    const query = new URLSearchParams();
    if (params?.date_range) query.set('date_range', params.date_range);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.subject && params.subject !== 'all') query.set('subject', params.subject);

    const res = await fetch(`${API_BASE}/analytics/overview?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch analytics overview');
    return res.json();
  },

  async getStudyGoals(): Promise<{ daily_hours_target: number; daily_question_target: number; subject_targets: Record<string, number> }> {
    const res = await fetch(`${API_BASE}/study/goals`);
    if (!res.ok) throw new Error('Failed to fetch study goals');
    return res.json();
  },

  async saveStudyGoals(payload: {
    daily_hours_target: number;
    daily_question_target: number;
    subject_targets?: Record<string, number>;
  }): Promise<{ daily_hours_target: number; daily_question_target: number; subject_targets: Record<string, number> }> {
    const res = await fetch(`${API_BASE}/study/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save study goals');
    return res.json();
  },

  async recordStudySession(session: StudySession): Promise<void> {
    try {
      await fetch(`${API_BASE}/study/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
    } catch (err) {
      console.warn('Failed to sync study session with backend', err);
    }
  },

  getReportExportUrl(reportType: string): string {
    return `${API_BASE}/reports/export?report_type=${encodeURIComponent(reportType)}`;
  },
};

