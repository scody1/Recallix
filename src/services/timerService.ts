import { storageService } from './storage';
import { StudySession } from '../types';
import { api } from './api';

export interface PersistedTimerState {
  status: 'idle' | 'running' | 'paused';
  accumulatedSeconds: number;
  lastStartedTimestamp: number | null;
  currentSessionId: string | null;
  sessionDate: string;
  lastSyncTimestamp: number;
}

export type TimerListener = (state: PersistedTimerState, currentElapsed: number) => void;

const TIMER_STORAGE_KEY = 'study_os_timer_state_v1';
const BROADCAST_CHANNEL_NAME = 'study_os_timer_channel';

class TimerService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<TimerListener> = new Set();
  private timerInterval: number | null = null;
  private currentState: PersistedTimerState;

  constructor() {
    this.currentState = this.loadState();
    this.setupBroadcastChannel();
    this.setupStorageListener();
    this.startLocalTicker();
  }

  private loadState(): PersistedTimerState {
    const today = storageService.getTodayString();
    try {
      const saved = localStorage.getItem(TIMER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedTimerState;
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse timer state from localStorage', e);
    }

    return {
      status: 'idle',
      accumulatedSeconds: 0,
      lastStartedTimestamp: null,
      currentSessionId: null,
      sessionDate: today,
      lastSyncTimestamp: Date.now(),
    };
  }

  private saveState(state: PersistedTimerState): void {
    this.currentState = state;
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save timer state to localStorage', e);
    }
    this.broadcastState(state);
    this.notifyListeners();
  }

  private setupBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC_STATE') {
            this.currentState = event.data.state;
            this.notifyListeners();
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }
    }
  }

  private setupStorageListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === TIMER_STORAGE_KEY && event.newValue) {
          try {
            this.currentState = JSON.parse(event.newValue);
            this.notifyListeners();
          } catch (e) {
            console.warn('Failed to parse storage update', e);
          }
        }
      });
    }
  }

  private broadcastState(state: PersistedTimerState): void {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'SYNC_STATE', state });
      } catch (e) {
        console.warn('Broadcast channel postMessage error', e);
      }
    }
  }

  private handleMidnightRolloverIfNeeded(): void {
    const today = storageService.getTodayString();
    if (this.currentState.sessionDate && this.currentState.sessionDate !== today) {
      const yesterday = this.currentState.sessionDate;
      const finalElapsed = this.getElapsedSeconds();
      const currentSessionId = this.currentState.currentSessionId;

      // 1. Finalize yesterday's session
      if (currentSessionId && finalElapsed > 0) {
        const midnightToday = new Date();
        midnightToday.setHours(0, 0, 0, 0);
        const midnightTimestamp = midnightToday.getTime();

        const yesterdaySession: StudySession = {
          id: currentSessionId,
          date: yesterday,
          startTime: parseInt(currentSessionId.split('_')[1], 10) || (midnightTimestamp - finalElapsed * 1000),
          endTime: midnightTimestamp,
          durationSeconds: finalElapsed,
          completed: true,
        };
        storageService.saveSession(yesterdaySession);
        this.updateDailyRecordDelta(yesterday);
        api.recordStudySession(yesterdaySession).catch(() => {});
      }

      // 2. Start a fresh session for the new day
      const now = Date.now();
      const newSessionId = `session_${now}_${Math.random().toString(36).slice(2, 7)}`;
      const isRunning = this.currentState.status === 'running';

      const newState: PersistedTimerState = {
        status: isRunning ? 'running' : 'idle',
        accumulatedSeconds: 0,
        lastStartedTimestamp: isRunning ? now : null,
        currentSessionId: isRunning ? newSessionId : null,
        sessionDate: today,
        lastSyncTimestamp: now,
      };

      if (isRunning) {
        const newSession: StudySession = {
          id: newSessionId,
          date: today,
          startTime: now,
          durationSeconds: 0,
          completed: false,
        };
        storageService.saveSession(newSession);
      }

      this.saveState(newState);
    }
  }

  private startLocalTicker(): void {
    if (typeof window === 'undefined') return;
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = window.setInterval(() => {
      this.handleMidnightRolloverIfNeeded();
      this.notifyListeners();

      // Periodically sync today's active progress to storage if running
      if (this.currentState.status === 'running') {
        const now = Date.now();
        if (now - this.currentState.lastSyncTimestamp >= 10000) {
          this.syncCurrentSessionProgress();
        }
      }
    }, 500);
  }

  public getElapsedSeconds(): number {
    const { status, accumulatedSeconds, lastStartedTimestamp } = this.currentState;
    if (status === 'running' && lastStartedTimestamp) {
      const activeCurrent = Math.max(0, Math.floor((Date.now() - lastStartedTimestamp) / 1000));
      return accumulatedSeconds + activeCurrent;
    }
    return accumulatedSeconds;
  }

  public getState(): PersistedTimerState {
    return { ...this.currentState };
  }

  public subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState, this.getElapsedSeconds());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const elapsed = this.getElapsedSeconds();
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState, elapsed);
      } catch (e) {
        console.error('Error in timer listener', e);
      }
    });
  }

  // --- Controls ---

  public start(): void {
    const today = storageService.getTodayString();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    const newState: PersistedTimerState = {
      status: 'running',
      accumulatedSeconds: 0,
      lastStartedTimestamp: now,
      currentSessionId: sessionId,
      sessionDate: today,
      lastSyncTimestamp: now,
    };

    this.saveState(newState);

    // Create session record in storage
    const newSession: StudySession = {
      id: sessionId,
      date: today,
      startTime: now,
      durationSeconds: 0,
      completed: false,
    };
    storageService.saveSession(newSession);
  }

  public pause(): void {
    if (this.currentState.status !== 'running') return;

    const currentTotal = this.getElapsedSeconds();
    const newState: PersistedTimerState = {
      ...this.currentState,
      status: 'paused',
      accumulatedSeconds: currentTotal,
      lastStartedTimestamp: null,
      lastSyncTimestamp: Date.now(),
    };

    this.saveState(newState);
    this.syncCurrentSessionProgress(true);
  }

  public resume(): void {
    if (this.currentState.status !== 'paused') return;

    const now = Date.now();
    const newState: PersistedTimerState = {
      ...this.currentState,
      status: 'running',
      lastStartedTimestamp: now,
      lastSyncTimestamp: now,
    };

    this.saveState(newState);
  }

  public async reset(): Promise<void> {
    const { currentSessionId, sessionDate } = this.currentState;
    const finalElapsed = this.getElapsedSeconds();

    // Finalize current session if active seconds were recorded
    if (currentSessionId && finalElapsed > 0) {
      const session: StudySession = {
        id: currentSessionId,
        date: sessionDate,
        startTime: parseInt(currentSessionId.split('_')[1], 10) || Date.now(),
        endTime: Date.now(),
        durationSeconds: finalElapsed,
        completed: true,
      };
      await storageService.saveSession(session);
      await this.updateDailyRecordDelta(sessionDate);
      api.recordStudySession(session).catch(() => {});
    }

    const today = storageService.getTodayString();
    const newState: PersistedTimerState = {
      status: 'idle',
      accumulatedSeconds: 0,
      lastStartedTimestamp: null,
      currentSessionId: null,
      sessionDate: today,
      lastSyncTimestamp: Date.now(),
    };

    this.saveState(newState);
  }

  private async syncCurrentSessionProgress(isPaused = false): Promise<void> {
    const { currentSessionId, sessionDate } = this.currentState;
    if (!currentSessionId) return;

    const elapsed = this.getElapsedSeconds();
    this.currentState.lastSyncTimestamp = Date.now();

    const session: StudySession = {
      id: currentSessionId,
      date: sessionDate,
      startTime: parseInt(currentSessionId.split('_')[1], 10) || Date.now(),
      endTime: isPaused ? Date.now() : undefined,
      durationSeconds: elapsed,
      completed: false,
    };

    await storageService.saveSession(session);
    await this.updateDailyRecordDelta(sessionDate);
  }

  public async updateDailyRecordDelta(dateStr: string): Promise<void> {
    const sessions = await storageService.getSessionsForDate(dateStr);
    const totalSeconds = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    const existing = await storageService.getDailyRecord(dateStr);

    await storageService.saveDailyRecord({
      ...existing,
      totalSeconds,
      sessionsCount: sessions.length,
      lastUpdated: Date.now(),
    });
  }
}

export const timerService = new TimerService();
