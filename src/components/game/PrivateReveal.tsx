'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff, Fingerprint } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HOLD_DELAY_MS = 250;

/**
 * Press-and-hold privacy reveal for shared physical spaces.
 * - A privacy warning is shown first.
 * - Secret content is only MOUNTED while the control is held (not merely blurred),
 *   so it is not in the DOM otherwise.
 * - Releasing, losing focus, or hiding the tab hides it immediately.
 */
export function PrivateReveal({
  title,
  warning,
  children,
  onContinue,
  continued,
  continueLabel = 'I have memorised it',
}: {
  title: string;
  warning: string;
  children: React.ReactNode;
  /** Omit to show the reveal without a continue step (e.g. recalling your role mid-game). */
  onContinue?: () => void;
  continued?: boolean;
  continueLabel?: string;
}) {
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  const [holding, setHolding] = useState(false);
  const [seen, setSeen] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      setHolding(true);
      setSeen(true);
    }, HOLD_DELAY_MS);
  }, []);

  useEffect(() => {
    const onVis = () => document.visibilityState !== 'visible' && hide();
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onVis);
      hide();
    };
  }, [hide]);

  if (!acceptedWarning) {
    return (
      <div className="glass mx-auto max-w-md space-y-5 p-6 text-center">
        <EyeOff className="mx-auto size-10 text-gilt" aria-hidden />
        <h2 className="text-2xl">{title}</h2>
        <p className="text-parchment/80">{warning}</p>
        <Button size="lg" className="w-full" onClick={() => setAcceptedWarning(true)} data-testid="privacy-ok">
          My screen is private
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div
        role="button"
        tabIndex={0}
        aria-label={holding ? 'Release to hide' : 'Press and hold to reveal'}
        aria-pressed={holding}
        data-testid="reveal-hold"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={hide}
        onPointerCancel={hide}
        onLostPointerCapture={hide}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && hide()}
        onBlur={hide}
        className={cn(
          'relative grid min-h-[340px] cursor-pointer touch-none select-none place-items-center overflow-hidden rounded-lg border p-6 [-webkit-touch-callout:none]',
          holding ? 'border-gilt/60 bg-night-raised' : 'border-night-line bg-night-deep',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {holding ? (
            <motion.div key="secret" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="w-full" aria-live="assertive">
              {children}
            </motion.div>
          ) : (
            <motion.div key="cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }} className="space-y-3 text-center">
              <Fingerprint className="mx-auto size-14 text-gilt/80" aria-hidden />
              <p className="font-display text-xl">Press and hold to reveal</p>
              <p className="text-sm text-parchment/60">Release to hide it again. Keyboard: hold Space.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!onContinue ? null : continued ? (
        <p className="text-center text-parchment/70" role="status">
          Done. Waiting for the others.
        </p>
      ) : confirmSkip ? (
        <div className="glass space-y-3 p-4 text-center" role="alertdialog" aria-labelledby="skip-title">
          <p id="skip-title">You have not looked yet. It will not be shown again during play. Continue anyway?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setConfirmSkip(false)}>
              Go back
            </Button>
            <Button onClick={onContinue}>Continue</Button>
          </div>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => (seen ? onContinue() : setConfirmSkip(true))} data-testid="reveal-continue">
          {continueLabel}
        </Button>
      )}
    </div>
  );
}
