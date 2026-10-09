'use client';
import { BookOpen, History as HistoryIcon, MessageSquare, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRoom } from '@/client/useRoom';
import { BRAND } from '@/lib/branding';
import { guide, nameOf } from '@/lib/guide';
import { cn } from '@/lib/utils';
import type { RoomView } from '@/server/rooms';
import { ActionBar, Assassination, Chat, GameOver, History, QuestPanel, QuestReveal, TeamDisplay, TeamPicker, VotePanel, VoteResults } from './Actions';
import { PlayerChip, QuestTrack, RejectTrack } from './Board';
import { Embers } from './Embers';
import { InviteCard, Lobby } from './Lobby';
import { KnowledgeReveal, RoleReveal } from './Reveals';
import { ConnectionBadge, Countdown, PhaseBanner, RulesButton } from './Status';
import { RoleSigil } from './Art';
import { PrivateReveal } from './PrivateReveal';
import { ROLE_COPY } from '@/lib/branding';

export function RoomClient({ code }: { code: string }) {
  const slot = useSearchParams().get('seat') ?? 'main';
  const { view, status, fatal, send, command } = useRoom(code, slot);

  if (fatal) return <FatalScreen code={code} error={fatal} />;
  if (!view) return <LoadingScreen status={status} />;
  return <Table view={view} status={status} send={send} command={command} />;
}

function Table({
  view,
  status,
  send,
  command,
}: {
  view: RoomView;
  status: ReturnType<typeof useRoom>['status'];
  send: ReturnType<typeof useRoom>['send'];
  command: ReturnType<typeof useRoom>['command'];
}) {
  const g = view.game;
  const me = view.me;
  const guidance = guide(view);
  const phase = g?.phase ?? 'LOBBY';
  const self = view.members.find((m) => m.playerId === view.you.playerId);
  const [startError, setStartError] = useState<string | null>(null);
  const ack = () => command({ type: 'ACKNOWLEDGE' });
  const cmd = command as unknown as (b: Record<string, unknown> & { type: string }) => Promise<{ ok: boolean; message?: string }>;

  const blocker = !g ? lobbyBlocker(view) : null;

  // ----- the one primary area for this moment -----
  let main: React.ReactNode = null;
  if (!g) {
    main = (
      <>
        <Lobby view={view} send={send} blocker={blocker} />
        {!view.you.isSpectator && (
          <ActionBar>
            {view.you.isHost ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant={self?.ready ? 'secondary' : 'primary'} size="lg" onClick={() => send('lobby:ready', { ready: !self?.ready })} data-testid="ready">
                  {self?.ready ? 'Not ready' : 'I am ready'}
                </Button>
                <Button
                  size="lg"
                  disabled={!!blocker}
                  aria-describedby={blocker ? 'start-blocker' : undefined}
                  data-testid="start-game"
                  onClick={async () => {
                    const r = await send('lobby:start');
                    setStartError(r.ok ? null : r.message);
                  }}
                >
                  Start game
                </Button>
              </div>
            ) : (
              <Button className="w-full" variant={self?.ready ? 'secondary' : 'primary'} size="lg" onClick={() => send('lobby:ready', { ready: !self?.ready })} data-testid="ready">
                {self?.ready ? 'Not ready' : 'I am ready'}
              </Button>
            )}
            {startError && (
              <p role="alert" className="mt-2 text-center text-sm text-treason-soft">
                {startError}
              </p>
            )}
          </ActionBar>
        )}
        {view.you.isSpectator && view.settings.allowSpectators && (
          <Button variant="secondary" onClick={() => send('lobby:take-seat')}>
            Take a seat
          </Button>
        )}
      </>
    );
  } else if (phase === 'ROLE_REVEAL' && me) {
    main = <RoleReveal me={me} onContinue={ack} />;
  } else if (phase === 'KNOWLEDGE_REVEAL' && me) {
    main = <KnowledgeReveal me={me} members={view.members} onContinue={ack} />;
  } else if (phase === 'TEAM_PROPOSAL') {
    main = me?.isLeader ? <TeamPicker key={g.stepId} view={view} command={cmd} /> : <TeamDisplay view={view} />;
  } else if (phase === 'TEAM_VOTING') {
    main = (
      <>
        <TeamDisplay view={view} />
        {me && <VotePanel me={me} command={cmd} rejections={g.consecutiveRejections} />}
      </>
    );
  } else if (phase === 'VOTE_REVEAL') {
    main = <VoteResults view={view} />;
  } else if (phase === 'QUEST_ACTION') {
    main = (
      <>
        <TeamDisplay view={view} />
        {me && <QuestPanel me={me} command={cmd} failsRequired={g.quests[g.questIndex]!.failsRequired} />}
      </>
    );
  } else if (phase === 'QUEST_REVEAL') {
    main = <QuestReveal game={g} />;
  } else if (phase === 'ROUND_RESULT') {
    main = <QuestTrack game={g} />;
  } else if (phase === 'ASSASSINATION') {
    main = <Assassination view={view} me={me} command={cmd} />;
  } else if (phase === 'GAME_OVER') {
    main = <GameOver view={view} onRematch={() => send('game:rematch')} />;
  }

  const isRevealPhase = ['VOTE_REVEAL', 'QUEST_REVEAL', 'ROUND_RESULT'].includes(phase);

  return (
    <div className="min-h-dvh">
      <Embers />
      {/* Compact status bar */}
      <header className="safe-top sticky top-0 z-30 border-b border-white/[0.06] bg-night/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" className="font-display text-lg text-gilt">
            {BRAND.productName}
          </Link>
          <span className="text-sm text-parchment/60">Room {view.code}</span>
          <span className="ml-auto flex items-center gap-1">
            <ConnectionBadge status={status} />
            {me && g && g.phase !== 'ROLE_REVEAL' && g.phase !== 'KNOWLEDGE_REVEAL' && g.phase !== 'GAME_OVER' && <MyRoleButton view={view} />}
            <RulesButton phase={phase} next={guidance.next} />
          </span>
        </div>
        {g && g.quests.length > 0 && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-2 lg:hidden">
            <QuestTrack game={g} compact />
            <RejectTrack count={g.consecutiveRejections} />
          </div>
        )}
      </header>

      {status !== 'online' && (
        <div role="status" className="bg-gilt/15 px-4 py-2 text-center text-sm text-gilt">
          {status === 'offline' ? 'You are offline. Your seat is kept; we will reconnect you automatically.' : 'Reconnecting to the table…'}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Players (desktop) */}
        {g && (
          <aside className="hidden lg:block" aria-label="Players">
            <PlayerList view={view} />
          </aside>
        )}

        <main id="main" className={cn('space-y-5', !g && 'lg:col-span-3 lg:mx-auto lg:w-full lg:max-w-2xl')}>
          <PhaseBanner guidance={guidance} />
          {g && g.quests.length > 0 && (
            <div className="hidden space-y-3 lg:block">
              <QuestTrack game={g} />
              <div className="flex justify-center">
                <RejectTrack count={g.consecutiveRejections} />
              </div>
            </div>
          )}
          {view.discussionDeadline && phase === 'TEAM_PROPOSAL' && <Countdown deadline={view.discussionDeadline} serverTime={view.serverTime} label="Discussion" />}
          {view.settings.tutorial && g && guidance.next && phase !== 'GAME_OVER' && <p className="border-l-2 border-gilt/40 pl-3 text-sm text-parchment/70">{guidance.next}</p>}
          {main}
          {g && me && isRevealPhase && (
            <ActionBar>
              <Button size="lg" className="w-full" variant={me.hasAcknowledged ? 'secondary' : 'primary'} disabled={me.hasAcknowledged} onClick={ack} data-testid="continue">
                {me.hasAcknowledged ? `Waiting for ${g.players.length - g.acknowledgedPlayerIds.length}` : 'Continue'}
              </Button>
              {view.autoAdvanceAt && <p className="mt-1 text-center text-xs text-parchment/55">Moves on automatically shortly.</p>}
            </ActionBar>
          )}
          {/* Players (mobile) */}
          {g && (
            <details className="glass p-3 lg:hidden">
              <summary className="cursor-pointer select-none font-medium">Players and leader: {nameOf(view, g.leaderId)}</summary>
              <div className="mt-2">
                <PlayerList view={view} />
              </div>
            </details>
          )}
        </main>

        {/* History, rules and chat (desktop); collapsible on mobile */}
        {g && (
          <aside className="space-y-4" aria-label="History and chat">
            <SidePanel view={view} send={send} />
          </aside>
        )}
      </div>
    </div>
  );
}

function lobbyBlocker(view: RoomView): string | null {
  const seated = view.members.filter((m) => !m.isSpectator);
  if (seated.length < 5) return `Waiting for ${5 - seated.length} more player${5 - seated.length > 1 ? 's' : ''}.`;
  if (seated.length > 10) return 'Too many players for one game.';
  const err = view.configIssues.find((i) => i.severity === 'error');
  if (err) return err.message;
  const notReady = seated.filter((m) => !m.ready).length;
  if (notReady) return `Waiting for ${notReady} player${notReady > 1 ? 's' : ''} to get ready.`;
  const offline = seated.filter((m) => !m.connected);
  if (offline.length) return `${offline.map((m) => m.name).join(', ')} is offline. Wait or remove them.`;
  return null;
}

function PlayerList({ view }: { view: RoomView }) {
  const g = view.game!;
  const proposal = g.proposals.at(-1);
  const quest = g.quests[g.questIndex];
  const byId = new Map(view.members.map((m) => [m.playerId, m]));
  return (
    <ul className="space-y-1">
      {g.players.map((id) => {
        const m = byId.get(id);
        if (!m) return null;
        const onTeam = ['TEAM_VOTING', 'VOTE_REVEAL'].includes(g.phase) ? !!proposal?.team.includes(id) : ['QUEST_ACTION', 'QUEST_REVEAL'].includes(g.phase) && !!quest?.team.includes(id);
        const acted =
          g.phase === 'TEAM_VOTING' ? g.votedPlayerIds.includes(id) : ['ROLE_REVEAL', 'KNOWLEDGE_REVEAL', 'VOTE_REVEAL', 'QUEST_REVEAL', 'ROUND_RESULT'].includes(g.phase) ? g.acknowledgedPlayerIds.includes(id) : false;
        return (
          <li key={id}>
            <PlayerChip
              member={m}
              you={id === view.you.playerId}
              state={{
                isLeader: g.leaderId === id,
                onTeam,
                draft: g.phase === 'TEAM_PROPOSAL' && g.draftTeam.includes(id),
                hasActed: acted,
                vote: g.phase === 'VOTE_REVEAL' ? (proposal?.votes?.[id] ?? null) : null,
                label: g.phase === 'TEAM_VOTING' ? (acted ? 'Voted' : 'Deciding') : undefined,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

function SidePanel({ view, send }: { view: RoomView; send: ReturnType<typeof useRoom>['send'] }) {
  const [tab, setTab] = useState<'history' | 'chat'>('history');
  return (
    <div className="glass p-3">
      <div role="tablist" aria-label="Side panel" className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-night-deep/60 p-1">
        {(
          [
            ['history', 'History', <HistoryIcon key="h" className="size-4" aria-hidden />],
            ['chat', 'Chat', <MessageSquare key="c" className="size-4" aria-hidden />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('flex min-h-10 items-center justify-center gap-1.5 rounded text-sm', tab === id ? 'bg-night-raised text-parchment' : 'text-parchment/60')}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="max-h-[60dvh] overflow-y-auto">
        {tab === 'history' ? <History view={view} /> : <Chat view={view} send={send} />}
      </div>
      <Link href="/rules" target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-sm text-gilt underline-offset-4 hover:underline">
        <BookOpen className="size-4" aria-hidden /> How to play
      </Link>
    </div>
  );
}

function MyRoleButton({ view }: { view: RoomView }) {
  const me = view.me!;
  const copy = ROLE_COPY[me.roleId]!;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <ScrollText aria-hidden /> My role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Your role</DialogTitle>
        <DialogDescription className="sr-only">Press and hold to see your role again. It hides when you let go.</DialogDescription>
        <div className="mt-4">
          <PrivateReveal title="Check your role" warning="Make sure nobody can see your screen.">
            <div className="space-y-3 text-center">
              <RoleSigil roleId={me.roleId} alignment={me.alignment} className="mx-auto size-20" />
              <p className="font-display text-3xl">{copy.name}</p>
              <p className="text-parchment/75">{copy.summary}</p>
              {me.knowledge.length > 0 && (
                <p className="text-sm text-parchment/70">
                  You know: {me.knowledge.map((k) => `${nameOf(view, k.playerId)} (${k.label === 'EVIL' ? 'Evil' : 'Merlin or Morgana'})`).join(', ')}
                </p>
              )}
            </div>
          </PrivateReveal>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingScreen({ status }: { status: string }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6 text-center" aria-busy="true">
      <div className="space-y-3">
        <div className="mx-auto size-10 animate-spin rounded-full border-2 border-gilt/30 border-t-gilt" aria-hidden />
        <p className="font-display text-xl">{status === 'offline' ? 'Waiting for a connection…' : 'Taking your seat…'}</p>
      </div>
    </main>
  );
}

function FatalScreen({ code, error }: { code: string; error: { code: string; message: string } }) {
  const canJoin = error.code === 'NO_SEAT' || error.code === 'SESSION_INVALID';
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <div className="glass max-w-md space-y-4 p-6 text-center">
        <h1 className="text-3xl">{error.code === 'ROOM_NOT_FOUND' ? 'Room not found' : error.code === 'REMOVED' ? 'You left the table' : 'Seat not found'}</h1>
        <p className="text-parchment/80">{error.message}</p>
        <div className="grid gap-2">
          {canJoin && (
            <Button asChild size="lg">
              <Link href={`/join?code=${code}`}>Join room {code}</Link>
            </Button>
          )}
          <Button asChild variant="secondary" size="lg">
            <Link href="/">Back to start</Link>
          </Button>
        </div>
        {canJoin && <InviteHint />}
      </div>
    </main>
  );
}

function InviteHint() {
  return <p className="text-sm text-parchment/60">If you were already playing on another device, open the game there to keep your original seat.</p>;
}

export { InviteCard };
