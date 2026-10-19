import React from 'react';
import { Play, Pause, RotateCcw, Clock, Sparkles } from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { NavSection } from '../../types';
import { formatTimeHHMMSS } from '../../utils/formatters';

interface HeaderProps {
  currentSection: NavSection;
}

const sectionTitles: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of active study progress' },
  'question-library': { title: 'Question Library', subtitle: 'Database of practice questions' },
  'practice-arena': { title: 'Practice Arena', subtitle: 'Targeted test and timed drills' },
  'revision-centre': { title: 'Revision Centre', subtitle: 'Spaced repetition and mistake reviews' },
  analytics: { title: 'Analytics', subtitle: 'Longitudinal performance and time tracking' },
  'import-centre': { title: 'Import Centre', subtitle: 'PDF documents and source ingestion' },
};

export const Header: React.FC<HeaderProps> = ({ currentSection }) => {
  const {
    status,
    formattedTime,
    todayActiveSeconds,
    start,
    pause,
    resume,
    reset,
  } = useTimer();

  const currentInfo = sectionTitles[currentSection] || {
    title: 'Recallix',
    subtitle: 'Turn Questions Into Mastery',
  };

  return (
    <header className="h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Current Section Title */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-neutral-100 tracking-tight">
              {currentInfo.title}
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
              Desktop
            </span>
          </div>
          <p className="text-xs text-neutral-400 font-normal">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Global Persistent Stopwatch & Controls */}
      <div className="flex items-center gap-4">
        {/* Today's total active tally */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900/90 border border-neutral-800 text-xs">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-400">Today:</span>
          <span className="font-mono font-medium text-neutral-200">
            {formatTimeHHMMSS(todayActiveSeconds)}
          </span>
        </div>

        {/* Stopwatch Bar */}
        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 shadow-sm">
          {/* Status Indicator & Digital Readout */}
          <div className="flex items-center gap-2 px-3 py-1">
            <div className="relative flex items-center justify-center w-2 h-2">
              {status === 'running' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  status === 'running'
                    ? 'bg-emerald-500'
                    : status === 'paused'
                    ? 'bg-amber-500'
                    : 'bg-neutral-600'
                }`}
              />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-semibold tracking-wider text-neutral-100">
                {formattedTime}
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-neutral-800 mx-1" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {status === 'idle' && (
              <button
                onClick={start}
                title="Start Study Session"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-100 hover:bg-white text-neutral-950 font-medium text-xs transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start</span>
              </button>
            )}

            {status === 'running' && (
              <>
                <button
                  onClick={pause}
                  title="Pause Study Session"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition-colors cursor-pointer border border-neutral-700/50"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={reset}
                  title="End and Save Session"
                  className="inline-flex items-center p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <button
                  onClick={resume}
                  title="Resume Study Session"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Resume</span>
                </button>
                <button
                  onClick={reset}
                  title="Reset and Finalize Session"
                  className="inline-flex items-center p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* System Phase Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-neutral-400 font-mono pl-2 border-l border-neutral-800">
          <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
          <span>v0.1</span>
        </div>
      </div>
    </header>
  );
};
