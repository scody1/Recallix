import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Target,
  RotateCw,
  BarChart3,
  UploadCloud,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { NavSection } from '../../types';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'question-library', label: 'Question Library', icon: BookOpen },
  { id: 'practice-arena', label: 'Practice Arena', icon: Target },
  { id: 'revision-centre', label: 'Revision Centre', icon: RotateCw },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'import-centre', label: 'Import Centre', icon: UploadCloud },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
}) => {
  return (
    <aside className="w-64 h-screen bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-950 font-bold font-mono text-sm tracking-tighter shadow-sm">
              R
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-wide text-neutral-100">
                RECALLIX
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                DESKTOP EDITION
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
            P1
          </span>
        </div>

        {/* Navigation Links */}
        <div className="p-3">
          <div className="px-3 pb-2 pt-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
            Workspace
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-neutral-900 text-white border border-neutral-800 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-neutral-100' : 'text-neutral-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.tag && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                      {item.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-neutral-800/80 bg-neutral-950/50">
        <div className="rounded-lg bg-neutral-900/80 border border-neutral-800 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-neutral-500" />
              <span>Engine</span>
            </span>
            <span className="font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-neutral-500" />
              <span>Storage</span>
            </span>
            <span className="font-mono text-neutral-400">IndexedDB</span>
          </div>
        </div>
        <p className="text-[10px] text-neutral-600 text-center mt-2.5 font-mono">
          Phase 1: Foundation & UI
        </p>
      </div>
    </aside>
  );
};
