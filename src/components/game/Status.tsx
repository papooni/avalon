'use client';
import { HelpCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ConnectionStatus } from '@/client/useRoom';
import { PHASE_RULES, type Guidance } from '@/lib/guide';
import { cn } from '@/lib/utils';

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const map = {
    online: { icon: <Wifi aria-hidden className="size-4" />, text: 'Connected', cls: 'text-parchment/60' },
    connecting: { icon: <Loader2 aria-hidden className="size-4 animate-spin" />, text: 'Connecting', cls: 'text-gilt' },
    reconnecting: { icon: <Loader2 aria-hidden className="size-4 animate-spin" />, text: 'Reconnecting', cls: 'text-gilt' },
    offline: { icon: <WifiOff aria-hidden className="size-4" />, text: 'Offline', cls: 'text-treason-soft' },
  }[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', map.cls)} role="status">
      {map.icon}
      <span>{map.text}</span>
    </span>
  );
}

/** Announces phase changes to screen readers and shows the guidance headline. */
export function PhaseBanner({ guidance }: { guidance: Guidance }) {
  const [announce, setAnnounce] = useState('');
  const last = useRef('');
  useEffect(() => {
    const msg = `${guidance.phaseLabel}. ${guidance.headline}`;
    if (msg !== last.current) {
      last.current = msg;
      setAnnounce(msg);
    }
  }, [guidance.phaseLabel, guidance.headline]);

  return (
    <section aria-labelledby="phase-headline" className="space-y-1.5">
      <p className="text-sm text-gilt">{guidance.phaseLabel}</p>
      <h1 id="phase-headline" className="text-2xl sm:text-3xl">
        {guidance.headline}
      </h1>
      {guidance.detail && <p className="max-w-prose text-parchment/75">{guidance.detail}</p>}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </section>
  );
}

export function RulesButton({ phase, next }: { phase: string; next?: string }) {
  const rules = PHASE_RULES[phase] ?? PHASE_RULES.LOBBY!;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Why? Explain this phase">
          <HelpCircle aria-hidden /> Why?
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{rules.title}</DialogTitle>
        <DialogDescription className="sr-only">An explanation of the current phase. It never reveals secret information.</DialogDescription>
        <div className="mt-4 space-y-3 text-parchment/85">
          {rules.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {next && <p className="border-l-2 border-gilt/50 pl-3 text-parchment">{next}</p>}
          <p className="pt-2 text-sm">
            <a className="text-gilt underline underline-offset-4" href="/rules" target="_blank" rel="noreferrer">
              Read the full guide
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Countdown({ deadline, serverTime, label }: { deadline: number; serverTime: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  const skew = useRef(serverTime - Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((deadline - (now + skew.current)) / 1000));
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, '0');
  return (
    <span className={cn('tabular-nums text-sm', left < 30 ? 'text-treason-soft' : 'text-parchment/70')} aria-label={`${label}: ${m} minutes ${s} seconds left`}>
      {label} {m}:{s}
    </span>
  );
}
