import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-500/20 text-gray-400',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  danger: 'bg-danger/20 text-danger',
  info: 'bg-accent/20 text-accent',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClass = variantClasses[variant];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantClass} ${className}`}>
      {children}
    </span>
  );
}
