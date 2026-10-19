import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
}) => {
  return (
    <div
      className={`bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-5 shadow-sm backdrop-blur-sm ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-800/50">
          <div>
            {title && <h3 className="text-sm font-semibold text-neutral-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
