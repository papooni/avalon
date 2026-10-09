'use client';
import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

/** A handful of slow, dim embers. Decorative, non-flashing, and off for reduced motion. */
export function Embers({ count = 14 }: { count?: number }) {
  const reduce = useReducedMotion();
  const embers = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i * 1.7) % 12}s`,
        duration: `${14 + ((i * 5) % 10)}s`,
        size: 2 + (i % 3),
      })),
    [count],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-[-10px] animate-ember rounded-full bg-gilt/70 blur-[1px]"
          style={{ left: e.left, width: e.size, height: e.size, animationDelay: e.delay, animationDuration: e.duration }}
        />
      ))}
    </div>
  );
}
