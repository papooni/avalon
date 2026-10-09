'use client';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-night-line bg-night-deep transition-colors data-[state=checked]:border-gilt/60 data-[state=checked]:bg-gilt/80 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-1 rounded-full bg-parchment shadow transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-night" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = 'Switch';
