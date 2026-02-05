import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white text-black hover:bg-gray-200 border-gray-300',
  secondary: 'bg-card text-white hover:bg-card-hover border-border',
  outline: 'bg-transparent text-white hover:bg-card border-border',
  ghost: 'bg-transparent text-white hover:bg-card border-transparent',
  danger: 'bg-danger text-white hover:bg-red-600 border-danger',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-semibold rounded-md border transition-all duration-150 inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
