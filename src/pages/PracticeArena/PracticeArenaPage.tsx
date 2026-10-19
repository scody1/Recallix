import React, { useState, useEffect } from 'react';
import { PracticeSetup } from '../../components/practice/PracticeSetup';
import { PracticeTestInterface } from '../../components/practice/PracticeTestInterface';
import { PracticeResults } from '../../components/practice/PracticeResults';
import { PracticeConfig, PracticeSession, NavSection } from '../../types';
import { api } from '../../services/api';

interface PracticeArenaPageProps {
  onNavigate: (section: NavSection) => void;
}

export const PracticeArenaPage: React.FC<PracticeArenaPageProps> = ({
  onNavigate,
}) => {
  const [activeSession, setActiveSession] = useState<PracticeSession | null>(null);
  const [completedSession, setCompletedSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasStoredActive, setHasStoredActive] = useState<boolean>(false);

  // Check for active unfinished sessions on mount for recovery
  useEffect(() => {
    async function checkActive() {
      setIsLoading(true);
      try {
        const stored = await api.getActivePracticeSession();
        if (stored && stored.status === 'in_progress') {
          setActiveSession(stored);
          setHasStoredActive(true);
        }
      } catch (err) {
        console.warn('Failed to check active session', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkActive();
  }, []);

  const handleStartSession = async (config: PracticeConfig) => {
    try {
      const created = await api.createPracticeSession(config);
      setActiveSession(created);
      setCompletedSession(null);
    } catch (err: any) {
      alert(`Could not start practice session: ${err.message}`);
    }
  };

  const handleResumeSession = () => {
    // Already in activeSession, simply set view
    setCompletedSession(null);
  };

  const handleFinishTest = (results: PracticeSession) => {
    setActiveSession(null);
    setCompletedSession(results);
    setHasStoredActive(false);
  };

  const handleRestart = () => {
    setActiveSession(null);
    setCompletedSession(null);
    setHasStoredActive(false);
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-neutral-500 font-mono">
        Checking practice engine state...
      </div>
    );
  }

  // View 1: Active Test in progress
  if (activeSession && activeSession.status === 'in_progress') {
    return (
      <PracticeTestInterface
        session={activeSession}
        onFinish={handleFinishTest}
        onExit={handleRestart}
      />
    );
  }

  // View 2: Completed Test Results
  if (completedSession) {
    return (
      <PracticeResults
        session={completedSession}
        onRestart={handleRestart}
        onDashboard={() => onNavigate('dashboard')}
      />
    );
  }

  // View 3: Configuration & Setup
  return (
    <PracticeSetup
      onStartSession={handleStartSession}
      onResumeSession={handleResumeSession}
      hasActiveSession={hasStoredActive}
    />
  );
};
