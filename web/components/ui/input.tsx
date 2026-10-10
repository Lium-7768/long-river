import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md bg-lr-surface/60 px-3 py-1 text-sm',
      'border border-lr-line text-lr-fg placeholder:text-lr-muted',
      'outline-none transition-colors focus:border-lr-accent focus:shadow-glow',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
