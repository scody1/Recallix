import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phaseNote?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  phaseNote,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30">
      <div className="w-12 h-12 rounded-xl bg-neutral-800/60 border border-neutral-750 flex items-center justify-center text-neutral-400 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-neutral-200 mb-1">{title}</h3>
      <p className="text-sm text-neutral-400 max-w-md mb-4 leading-relaxed">
        {description}
      </p>
      {phaseNote && (
        <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800/70 border border-neutral-700/60 text-xs text-neutral-300 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          {phaseNote}
        </div>
      )}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 font-medium text-xs transition-colors shadow-sm cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
