import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatWidgetProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'neutral' | 'success' | 'warning' | 'info';
}

export const StatWidget: React.FC<StatWidgetProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  badge,
  badgeVariant = 'neutral',
}) => {
  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4.5 flex flex-col justify-between hover:border-neutral-700/70 transition-colors">
      <div className="flex items-center justify-between text-neutral-400 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg bg-neutral-800/60 flex items-center justify-center text-neutral-300">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold font-mono tracking-tight text-white">
            {value}
          </span>
          {badge && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                badgeVariant === 'success'
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        {subValue && (
          <p className="text-xs text-neutral-500 mt-1.5 font-normal">
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
};
