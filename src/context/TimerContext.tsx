import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { timerService, PersistedTimerState } from '../services/timerService';
import { storageService } from '../services/storage';
import { formatTimeHHMMSS } from '../utils/formatters';

interface TimerContextValue {
  status: 'idle' | 'running' | 'paused';
  elapsedSeconds: number;
  formattedTime: string;
  todayActiveSeconds: number;
  todayTargetSeconds: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  refreshTodayStats: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timerState, setTimerState] = useState<PersistedTimerState>(() => timerService.getState());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => timerService.getElapsedSeconds());
  const [todayActiveSeconds, setTodayActiveSeconds] = useState<number>(0);
  const [todayTargetSeconds, setTodayTargetSeconds] = useState<number>(4 * 3600);

  const loadTodayStats = useCallback(async () => {
    const today = storageService.getTodayString();
    const record = await storageService.getDailyRecord(today);
    setTodayActiveSeconds(record.totalSeconds);
    setTodayTargetSeconds(record.targetSeconds || 4 * 3600);
  }, []);

  useEffect(() => {
    loadTodayStats();

    const unsubscribe = timerService.subscribe((state, currentElapsed) => {
      setTimerState(state);
      setElapsedSeconds(currentElapsed);
    });

    // Also periodic update for today stats
    const interval = setInterval(() => {
      loadTodayStats();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadTodayStats]);

  const handleStart = useCallback(() => {
    timerService.start();
  }, []);

  const handlePause = useCallback(() => {
    timerService.pause();
    loadTodayStats();
  }, [loadTodayStats]);

  const handleResume = useCallback(() => {
    timerService.resume();
  }, []);

  const handleReset = useCallback(async () => {
    await timerService.reset();
    await loadTodayStats();
  }, [loadTodayStats]);

  const value: TimerContextValue = {
    status: timerState.status,
    elapsedSeconds,
    formattedTime: formatTimeHHMMSS(elapsedSeconds),
    // If the timer is actively running, today's display includes current session elapsed
    todayActiveSeconds:
      timerState.status === 'running'
        ? Math.max(todayActiveSeconds, todayActiveSeconds + elapsedSeconds)
        : todayActiveSeconds,
    todayTargetSeconds,
    start: handleStart,
    pause: handlePause,
    resume: handleResume,
    reset: handleReset,
    refreshTodayStats: loadTodayStats,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = (): TimerContextValue => {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return ctx;
};
