import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
}) => {
  const variantStyles = {
    neutral: 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60',
    success: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40',
    warning: 'bg-amber-950/40 text-amber-400 border-amber-800/40',
    info: 'bg-blue-950/40 text-blue-400 border-blue-800/40',
  }[variant];

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium font-mono ${variantStyles} ${sizeStyles}`}
    >
      {children}
    </span>
  );
};
