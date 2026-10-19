import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NavSection } from '../../types';

interface AppLayoutProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentSection,
  onSelectSection,
  children,
}) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-neutral-100">
      {/* Fixed Left Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={onSelectSection}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header currentSection={currentSection} />

        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
