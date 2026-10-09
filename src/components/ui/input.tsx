import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-12 w-full rounded-md border border-night-line bg-night-deep/70 px-4 text-base text-parchment placeholder:text-parchment/40 focus-visible:border-gilt/60',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
