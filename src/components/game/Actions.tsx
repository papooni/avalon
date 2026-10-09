'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Send, ShieldCheck, Skull, Swords, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PrivatePlayerState, PublicGameState } from '@/engine';
import { BRAND, roleName } from '@/lib/branding';
import { nameOf } from '@/lib/guide';
import { cn, plural } from '@/lib/utils';
import type { PublicMember, RoomView } from '@/server/rooms';
import { AvatarGlyph, RoleSigil } from './Art';
import { PlayerChip } from './Board';

type Command = (body: Record<string, unknown> & { type: string }) => Promise<{ ok: boolean; message?: string }>;

function orderedMembers(view: RoomView): PublicMember[] {
  const byId = new Map(view.members.map((m) => [m.playerId, m]));
  return (view.game?.players ?? []).map((id) => byId.get(id)).filter((m): m is PublicMember => !!m);
}

function useActionError() {
  const [error, setError] = useState<string | null>(null);
  const run = async (p: Promise<{ ok: boolean; message?: string }>) => {
    const r = await p;
    setError(r.ok ? null : (r.message ?? 'That did not work. Try again.'));
    return r.ok;
  };
  const node = error ? (
    <p role="alert" className="text-sm text-treason-soft">
      {error}
    </p>
  ) : null;
  return { run, node };
}

// ---------------------------------------------------------------------------

export function TeamPicker({ view, command, onSelectionChange }: { view: RoomView; command: Command; onSelectionChange?: (n: number) => void }) {
  const g = view.game!;
  const size = g.quests[g.questIndex]!.size;
  const [team, setTeam] = useState<string[]>(g.draftTeam);
  const { run, node } = useActionError();
  const [busy, setBusy] = useState(false);

  useEffect(() => onSelectionChange?.(team.length), [team.length, onSelectionChange]);

  const toggle = (id: string) => {
    const next = team.includes(id) ? team.filter((x) => x !== id) : team.length < size ? [...team, id] : team;
    setTeam(next);
    void command({ type: 'DRAFT_TEAM', team: next }); // shares the leader's thinking with the table
  };
  const remaining = size - team.length;
  const reason = remaining > 0 ? `Select ${plural(remaining, 'more player')}.` : null;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 font-medium">
          Choose {size} for quest {g.questIndex + 1}{' '}
          <span className="text-parchment/60">
            ({team.length}/{size} selected)
          </span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {orderedMembers(view).map((m) => (
            <PlayerChip
              key={m.playerId}
              member={m}
              you={m.playerId === view.you.playerId}
              state={{ isLeader: g.leaderId === m.playerId, selected: team.includes(m.playerId), selectable: team.length < size }}
              onSelect={() => toggle(m.playerId)}
            />
          ))}
        </div>
      </fieldset>
      {node}
      <ActionBar>
        <Button
          size="lg"
          className="w-full"
          disabled={!!reason || busy}
          aria-describedby={reason ? 'propose-reason' : undefined}
          data-testid="propose-team"
          onClick={async () => {
            setBusy(true);
            await run(command({ type: 'PROPOSE_TEAM', team }));
            setBusy(false);
          }}
        >
          Propose this team
        </Button>
        {reason && (
          <p id="propose-reason" className="mt-1 text-center text-sm text-parchment/65">
            {reason}
          </p>
        )}
      </ActionBar>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TeamDisplay({ view }: { view: RoomView }) {
  const g = view.game!;
  const proposal = g.proposals.at(-1);
  const team = g.phase === 'TEAM_PROPOSAL' ? g.draftTeam : (proposal?.team ?? []);
  const size = g.quests[g.questIndex]?.size ?? 0;
  if (g.phase === 'TEAM_PROPOSAL' && team.length === 0) return null;
  return (
    <div className="glass p-4">
      <p className="mb-2 text-sm text-parchment/65">
        {g.phase === 'TEAM_PROPOSAL' ? `${nameOf(view, g.leaderId)} is considering (${team.length}/${size})` : 'Proposed team'}
      </p>
      <ul className="flex flex-wrap gap-2">
        {team.map((id) => {
          const m = view.members.find((x) => x.playerId === id);
          return (
            <li key={id} className="flex items-center gap-2 rounded-full border border-loyal/40 bg-loyal/10 py-1 pl-1 pr-3">
              <AvatarGlyph avatar={m?.avatar ?? 'oak'} className="size-8" />
              <span>{id === view.you.playerId ? 'You' : (m?.name ?? 'A player')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VotePanel({ me, command, rejections }: { me: PrivatePlayerState; command: Command; rejections: number }) {
  const { run, node } = useActionError();
  const [busy, setBusy] = useState(false);
  if (me.hasVoted) {
    return (
      <div className="glass flex items-center gap-3 p-4" role="status">
        <ShieldCheck className="size-6 text-gilt" aria-hidden />
        <p>
          You voted <strong>{me.myPendingVote ? 'Approve' : 'Reject'}</strong>. Your vote is locked and stays hidden until everyone has voted.
        </p>
      </div>
    );
  }
  const vote = async (approve: boolean) => {
    setBusy(true);
    await run(command({ type: 'CAST_VOTE', approve }));
    setBusy(false);
  };
  return (
    <ActionBar>
      {rejections === 4 && (
        <p className="mb-2 text-center text-sm text-treason-soft" role="note">
          Four teams were rejected in a row. Rejecting this one ends the game in Evil’s favour.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="treason" disabled={busy} onClick={() => vote(false)} data-testid="vote-reject">
          <X aria-hidden /> Reject
        </Button>
        <Button size="lg" variant="loyal" disabled={busy} onClick={() => vote(true)} data-testid="vote-approve">
          <Check aria-hidden /> Approve
        </Button>
      </div>
      {node}
    </ActionBar>
  );
}

// ---------------------------------------------------------------------------

export function VoteResults({ view }: { view: RoomView }) {
  const g = view.game!;
  const p = g.proposals.at(-1)!;
  const reduce = useReducedMotion();
  return (
    <div className="glass p-4">
      <p className="mb-3 font-medium">
        {p.approved ? 'Approved' : 'Rejected'}, attempt {p.attempt} for quest {p.questIndex + 1}
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {orderedMembers(view).map((m, i) => (
          <motion.li key={m.playerId} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : i * 0.04 }}>
            <PlayerChip member={m} you={m.playerId === view.you.playerId} state={{ vote: p.votes?.[m.playerId] ?? null, onTeam: p.team.includes(m.playerId), isLeader: p.leaderId === m.playerId }} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function QuestPanel({ me, command, failsRequired }: { me: PrivatePlayerState; command: Command; failsRequired: number }) {
  const { run, node } = useActionError();
  const [busy, setBusy] = useState(false);
  if (!me.isOnQuestTeam) return null;
  if (me.hasPlayedQuestCard) {
    return (
      <div className="glass flex items-center gap-3 p-4" role="status">
        <ShieldCheck className="size-6 text-gilt" aria-hidden />
        <p>Your card is played face down. All cards are shuffled before anyone sees them.</p>
      </div>
    );
  }
  const play = async (card: 'SUCCESS' | 'FAIL') => {
    setBusy(true);
    await run(command({ type: 'SUBMIT_QUEST_CARD', card }));
    setBusy(false);
  };
  return (
    <ActionBar>
      <p className="mb-2 text-center text-sm text-parchment/70">Shield your screen. {failsRequired > 1 ? 'This quest needs two Fail cards to fail.' : ''}</p>
      <div className={cn('grid gap-3', me.canFail ? 'grid-cols-2' : 'grid-cols-1')}>
        <Button size="lg" variant="loyal" disabled={busy} onClick={() => play('SUCCESS')} data-testid="quest-success">
          <Swords aria-hidden /> Success
        </Button>
        {me.canFail && (
          <Button size="lg" variant="treason" disabled={busy} onClick={() => play('FAIL')} data-testid="quest-fail">
            <Skull aria-hidden /> Fail
          </Button>
        )}
      </div>
      {!me.canFail && <p className="mt-2 text-center text-sm text-parchment/65">Loyal players can only play Success, so Fail is not offered.</p>}
      {node}
    </ActionBar>
  );
}

// ---------------------------------------------------------------------------

export function QuestReveal({ game }: { game: PublicGameState }) {
  const q = game.quests[game.questIndex]!;
  const reduce = useReducedMotion();
  return (
    <div className="glass space-y-4 p-5 text-center">
      <ul className="flex flex-wrap justify-center gap-3" aria-label={`Cards revealed: ${q.successCount} Success, ${q.failCount} Fail`}>
        {q.revealedCards.map((c, i) => (
          <li key={i} className="[perspective:600px]">
            <motion.div
              initial={reduce ? false : { rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: reduce ? 0 : 0.35 + i * 0.45, duration: 0.45 }}
              className={cn(
                'grid h-28 w-20 place-items-center rounded-md border text-sm font-medium [backface-visibility:hidden]',
                c === 'SUCCESS' ? 'border-loyal-soft/50 bg-loyal-deep text-loyal-soft' : 'border-treason-soft/50 bg-treason-deep text-treason-soft',
              )}
            >
              <span className="flex flex-col items-center gap-1">
                {c === 'SUCCESS' ? <Swords className="size-6" aria-hidden /> : <Skull className="size-6" aria-hidden />}
                {c === 'SUCCESS' ? 'Success' : 'Fail'}
              </span>
            </motion.div>
          </li>
        ))}
      </ul>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.5 + q.revealedCards.length * 0.45 }}
        className={cn('font-display text-3xl', q.result === 'SUCCESS' ? 'text-loyal-soft' : 'text-treason-soft')}
        data-testid="quest-result"
      >
        {q.result === 'SUCCESS' ? 'Quest succeeded' : 'Quest failed'}
      </motion.p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Assassination({ view, me, command }: { view: RoomView; me: PrivatePlayerState | null; command: Command }) {
  const [target, setTarget] = useState<string | null>(null);
  const { run, node } = useActionError();
  if (!me?.isAssassin) return null;
  const candidates = new Set(me.assassinationCandidates);
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 font-medium">Who is Merlin?</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {orderedMembers(view)
            .filter((m) => candidates.has(m.playerId))
            .map((m) => (
              <button
                key={m.playerId}
                type="button"
                role="radio"
                aria-checked={target === m.playerId}
                onClick={() => setTarget(m.playerId)}
                className={cn('flex min-h-14 items-center gap-3 rounded-md border px-3', target === m.playerId ? 'border-treason-soft bg-treason/15' : 'border-night-line bg-night-deep/50')}
              >
                <AvatarGlyph avatar={m.avatar} />
                <span className="font-medium">{m.name}</span>
              </button>
            ))}
        </div>
      </fieldset>
      {node}
      <ActionBar>
        <Button size="lg" variant="treason" className="w-full" disabled={!target} data-testid="assassinate" onClick={() => target && run(command({ type: 'ASSASSINATE', targetId: target }))}>
          {target ? `Name ${nameOf(view, target)} as Merlin` : 'Choose a player first'}
        </Button>
      </ActionBar>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function GameOver({ view, onRematch }: { view: RoomView; onRematch: () => void }) {
  const g = view.game!;
  const good = g.winner === 'GOOD';
  return (
    <div className="space-y-5">
      <div className={cn('glass p-6 text-center', good ? 'border-loyal/40' : 'border-treason/40')}>
        <p className="text-sm text-parchment/70">{good ? BRAND.teamMembers.GOOD : BRAND.teamMembers.EVIL} prevail</p>
        <p className={cn('font-display text-5xl', good ? 'text-loyal-soft' : 'text-treason-soft')} data-testid="winner">
          {good ? 'Good wins' : 'Evil wins'}
        </p>
      </div>
      {g.finalRoles && (
        <section className="glass p-4" aria-labelledby="final-roles">
          <h2 id="final-roles" className="mb-3 text-xl">
            Everyone’s role
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {orderedMembers(view).map((m) => {
              const roleId = g.finalRoles![m.playerId]!;
              const evil = ['ASSASSIN', 'MINION', 'MORGANA', 'MORDRED', 'OBERON'].includes(roleId);
              return (
                <li key={m.playerId} className="flex items-center gap-3 rounded-md bg-night-deep/50 px-3 py-2">
                  <RoleSigil roleId={roleId} alignment={evil ? 'EVIL' : 'GOOD'} className="size-10" />
                  <span className="flex-1">
                    <span className="block font-medium">{m.name}</span>
                    <span className={cn('text-sm', evil ? 'text-treason-soft' : 'text-loyal-soft')}>{roleName(roleId)}</span>
                  </span>
                  {g.assassinationTarget === m.playerId && <span className="text-xs text-treason-soft">Assassin’s choice</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <Recap view={view} />
      {view.you.isHost && (
        <ActionBar>
          <Button size="lg" className="w-full" onClick={onRematch} data-testid="rematch">
            Start a rematch
          </Button>
        </ActionBar>
      )}
    </div>
  );
}

export function Recap({ view }: { view: RoomView }) {
  const g = view.game!;
  const byQuest = useMemo(() => g.quests.map((q) => ({ q, proposals: g.proposals.filter((p) => p.questIndex === q.index) })), [g]);
  return (
    <section className="glass p-4" aria-labelledby="recap-h">
      <h2 id="recap-h" className="mb-3 text-xl">
        How it played out
      </h2>
      <ol className="space-y-4">
        {byQuest
          .filter(({ proposals }) => proposals.length > 0)
          .map(({ q, proposals }) => (
            <li key={q.index}>
              <p className="font-medium">
                Quest {q.index + 1}:{' '}
                {q.result ? (
                  <span className={q.result === 'SUCCESS' ? 'text-loyal-soft' : 'text-treason-soft'}>
                    {q.result === 'SUCCESS' ? 'succeeded' : 'failed'} ({plural(q.failCount ?? 0, 'Fail')})
                  </span>
                ) : (
                  'not completed'
                )}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-parchment/75">
                {proposals.map((p) => {
                  const approvals = Object.values(p.votes ?? {}).filter(Boolean).length;
                  const total = Object.values(p.votes ?? {}).length;
                  return (
                    <li key={p.id}>
                      {nameOf(view, p.leaderId)} proposed {p.team.map((id) => nameOf(view, id)).join(', ')}:{' '}
                      {p.votes ? `${p.approved ? 'approved' : 'rejected'} ${approvals}–${total - approvals}` : 'vote not finished'}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function History({ view }: { view: RoomView }) {
  const g = view.game;
  if (!g || g.proposals.length === 0) return <p className="text-sm text-parchment/60">Proposals and votes will appear here.</p>;
  return (
    <ol className="space-y-3 text-sm" aria-label="Game history">
      {[...g.proposals].reverse().map((p) => {
        const approvals = Object.entries(p.votes ?? {}).filter(([, v]) => v);
        const rejections = Object.entries(p.votes ?? {}).filter(([, v]) => !v);
        return (
          <li key={p.id} className="rounded-md bg-night-deep/40 p-3">
            <p className="font-medium">
              Quest {p.questIndex + 1}, attempt {p.attempt}: {nameOf(view, p.leaderId)}
            </p>
            <p className="text-parchment/70">Team: {p.team.map((id) => nameOf(view, id)).join(', ')}</p>
            {p.votes ? (
              <>
                <p className={p.approved ? 'text-loyal-soft' : 'text-treason-soft'}>{p.approved ? 'Approved' : 'Rejected'}</p>
                <p className="text-parchment/60">Approve: {approvals.map(([id]) => nameOf(view, id)).join(', ') || 'none'}</p>
                <p className="text-parchment/60">Reject: {rejections.map(([id]) => nameOf(view, id)).join(', ') || 'none'}</p>
              </>
            ) : (
              <p className="text-parchment/60">Voting…</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Chat({ view, send }: { view: RoomView; send: (e: string, p: unknown) => Promise<{ ok: boolean; message?: string }> }) {
  const [text, setText] = useState('');
  const { run, node } = useActionError();
  if (!view.settings.chatEnabled) return <p className="text-sm text-parchment/60">The host has not turned on text chat.</p>;
  return (
    <div className="flex h-full flex-col gap-2">
      <ol className="min-h-40 flex-1 space-y-2 overflow-y-auto text-sm" aria-live="polite" aria-label="Room chat">
        {view.chat.map((m) => (
          <li key={m.id}>
            <span className="font-medium text-gilt">{nameOf(view, m.playerId)}</span> <span className="break-words text-parchment/85">{m.text}</span>
          </li>
        ))}
      </ol>
      {!view.you.isSpectator && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(send('chat:send', { text }))) setText('');
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <Input id="chat-input" value={text} maxLength={280} onChange={(e) => setText(e.target.value)} placeholder="Message the table" />
          <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim()}>
            <Send aria-hidden />
          </Button>
        </form>
      )}
      {node}
    </div>
  );
}

/** Sticky bottom action area on mobile; inline on larger screens. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/[0.06] bg-night/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  );
}
