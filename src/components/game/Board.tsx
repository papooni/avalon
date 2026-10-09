'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Crown, Shield, WifiOff, X } from 'lucide-react';
import type { PublicGameState } from '@/engine';
import { cn } from '@/lib/utils';
import type { PublicMember } from '@/server/rooms';
import { AvatarGlyph, QuestSeal } from './Art';

export function QuestTrack({ game, compact = false }: { game: PublicGameState; compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <ol className={cn('flex items-center justify-center', compact ? 'gap-1.5' : 'gap-2 sm:gap-4')} aria-label="Quest track">
      {game.quests.map((q) => {
        const state = q.result === 'SUCCESS' ? 'success' : q.result === 'FAIL' ? 'fail' : 'pending';
        const current = q.index === game.questIndex && game.phase !== 'GAME_OVER' && !q.result;
        const label = `Quest ${q.index + 1}: ${q.size} players${q.failsRequired > 1 ? ', needs 2 Fails to fail' : ''}. ${
          state === 'pending' ? (current ? 'Current quest.' : 'Not played yet.') : state === 'success' ? 'Succeeded.' : `Failed with ${q.failCount} Fail.`
        }`;
        return (
          <li key={q.index} className="flex flex-col items-center gap-1" aria-label={label} aria-current={current ? 'step' : undefined}>
            <motion.div
              key={state}
              initial={reduce || state === 'pending' ? false : { scale: 1.35, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              className={cn(compact ? 'size-9' : 'size-14 sm:size-20', current && 'drop-shadow-[0_0_14px_rgba(217,178,106,0.45)]')}
            >
              <QuestSeal state={state} size={q.size} failsRequired={q.failsRequired} current={current} />
            </motion.div>
            {!compact && <span className={cn('text-xs', current ? 'text-gilt' : 'text-parchment/55')}>Quest {q.index + 1}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function RejectTrack({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${count} of 5 consecutive rejected teams. At 5, Evil wins.`}>
      <span className="text-xs text-parchment/60">Rejections</span>
      <span className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'grid size-4 place-items-center rounded-full border text-[9px]',
              i < count ? 'border-treason-soft bg-treason text-white' : 'border-night-line bg-night-deep',
              i === 4 && i >= count && 'border-treason/70',
            )}
          >
            {i < count ? '✕' : ''}
          </span>
        ))}
      </span>
    </div>
  );
}

interface PlayerRowState {
  isLeader?: boolean;
  onTeam?: boolean;
  draft?: boolean;
  hasActed?: boolean;
  vote?: boolean | null;
  selectable?: boolean;
  selected?: boolean;
  label?: string;
}

export function PlayerChip({
  member,
  you,
  state,
  onSelect,
}: {
  member: PublicMember;
  you: boolean;
  state: PlayerRowState;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <AvatarGlyph avatar={member.avatar} className={cn(state.selected && 'border-gilt bg-gilt/15')} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5 truncate font-medium">
          <span className="truncate">{member.name}</span>
          {you && <span className="text-xs text-parchment/55">(you)</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-parchment/60">
          {state.isLeader && (
            <span className="inline-flex items-center gap-1 text-gilt">
              <Crown className="size-3.5" aria-hidden /> Leader
            </span>
          )}
          {(state.onTeam || state.draft) && (
            <span className={cn('inline-flex items-center gap-1', state.onTeam ? 'text-loyal-soft' : 'text-parchment/70')}>
              <Shield className="size-3.5" aria-hidden /> {state.onTeam ? 'On team' : 'Considered'}
            </span>
          )}
          {!member.connected && (
            <span className="inline-flex items-center gap-1 text-treason-soft">
              <WifiOff className="size-3.5" aria-hidden /> Offline
            </span>
          )}
          {state.label && <span>{state.label}</span>}
        </span>
      </span>
      {state.vote === true && (
        <span className="inline-flex items-center gap-1 rounded-full bg-loyal/20 px-2 py-0.5 text-xs text-loyal-soft">
          <Check className="size-3.5" aria-hidden /> Approve
        </span>
      )}
      {state.vote === false && (
        <span className="inline-flex items-center gap-1 rounded-full bg-treason/20 px-2 py-0.5 text-xs text-treason-soft">
          <X className="size-3.5" aria-hidden /> Reject
        </span>
      )}
      {state.vote == null && state.hasActed && <span className="text-xs text-parchment/60">Done</span>}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={!!state.selected}
        aria-disabled={!state.selectable && !state.selected}
        onClick={onSelect}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
          state.selected ? 'border-gilt/70 bg-gilt/10' : 'border-night-line bg-night-deep/50 hover:border-gilt/40',
          !state.selectable && !state.selected && 'opacity-50',
        )}
      >
        {content}
      </button>
    );
  }
  return <div className={cn('flex min-h-14 items-center gap-3 rounded-md px-3 py-2', !member.connected && 'opacity-70')}>{content}</div>;
}
