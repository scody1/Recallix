import React, { useState, useEffect } from 'react';
import { TimerProvider } from './context/TimerContext';
import { AppLayout } from './components/layout/AppLayout';
import { NavSection } from './types';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { QuestionLibraryPage } from './pages/QuestionLibrary/QuestionLibraryPage';
import { PracticeArenaPage } from './pages/PracticeArena/PracticeArenaPage';
import { RevisionCentrePage } from './pages/RevisionCentre/RevisionCentrePage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { ImportCentrePage } from './pages/ImportCentre/ImportCentrePage';

export const App: React.FC = () => {
  // Read initial section from URL hash if available
  const [currentSection, setCurrentSection] = useState<NavSection>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validSections: NavSection[] = [
        'dashboard',
        'question-library',
        'practice-arena',
        'revision-centre',
        'analytics',
        'import-centre',
      ];
      if (validSections.includes(hash as NavSection)) {
        return hash as NavSection;
      }
    }
    return 'dashboard';
  });

  // Sync section with URL hash
  useEffect(() => {
    window.location.hash = `#/${currentSection}`;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validSections: NavSection[] = [
        'dashboard',
        'question-library',
        'practice-arena',
        'revision-centre',
        'analytics',
        'import-centre',
      ];
      if (validSections.includes(hash as NavSection)) {
        setCurrentSection(hash as NavSection);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentSection]);

  const renderSectionContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentSection} />;
      case 'question-library':
        return <QuestionLibraryPage onNavigate={setCurrentSection} />;
      case 'practice-arena':
        return <PracticeArenaPage onNavigate={setCurrentSection} />;
      case 'revision-centre':
        return <RevisionCentrePage onNavigate={setCurrentSection} />;
      case 'analytics':
        return <AnalyticsPage onNavigate={setCurrentSection} />;
      case 'import-centre':
        return <ImportCentrePage />;
      default:
        return <DashboardPage onNavigate={setCurrentSection} />;
    }
  };

  return (
    <TimerProvider>
      <AppLayout
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
      >
        {renderSectionContent()}
      </AppLayout>
    </TimerProvider>
  );
};

export default App;
