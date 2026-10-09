'use client';
import { Check, Copy, Crown, Settings2, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PLAYER_COUNT_RULES } from '@/engine';
import { ROLE_COPY } from '@/lib/branding';
import { cn } from '@/lib/utils';
import type { RoomSettings, RoomView } from '@/server/rooms';
import { AvatarGlyph } from './Art';

type Send = (event: string, payload?: unknown) => Promise<{ ok: boolean; message?: string }>;

export function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/join?code=${code}` : '';
  const copy = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Join my game', url: link });
      else await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  };
  return (
    <div className="glass flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm text-parchment/65">Room code</p>
        <p className="font-display text-3xl tracking-[0.18em] text-gilt" aria-label={`Room code ${code.split('').join(' ')}`} data-testid="room-code">
          {code}
        </p>
      </div>
      <Button variant="secondary" onClick={copy}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? 'Link copied' : 'Share invite link'}
      </Button>
    </div>
  );
}

export function Lobby({ view, send, blocker }: { view: RoomView; send: Send; blocker: string | null }) {
  const seated = view.members.filter((m) => !m.isSpectator);
  const spectators = view.members.filter((m) => m.isSpectator);
  const n = seated.length;
  const rules = PLAYER_COUNT_RULES[n];
  const isHost = view.you.isHost;

  return (
    <div className="space-y-5">
      <InviteCard code={view.code} />

      <section aria-labelledby="players-h" className="glass p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="players-h" className="flex items-center gap-2 text-xl">
            <Users className="size-5 text-gilt" aria-hidden /> Players {n}/10
          </h2>
          {rules ? (
            <span className="text-sm text-parchment/70">
              {rules.good} Good, {rules.evil} Evil
            </span>
          ) : (
            <span className="text-sm text-parchment/70">5 to 10 players</span>
          )}
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {seated.map((m) => (
            <li key={m.playerId} className="flex min-h-14 items-center gap-3 py-2">
              <AvatarGlyph avatar={m.avatar} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {m.name} {m.playerId === view.you.playerId && <span className="text-xs text-parchment/55">(you)</span>}
                </span>
                <span className="flex gap-2 text-xs text-parchment/60">
                  {m.isHost && (
                    <span className="inline-flex items-center gap-1 text-gilt">
                      <Crown className="size-3.5" aria-hidden /> Host
                    </span>
                  )}
                  {!m.connected && <span className="text-treason-soft">Offline</span>}
                </span>
              </span>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs', m.ready ? 'bg-loyal/20 text-loyal-soft' : 'bg-white/5 text-parchment/60')}>
                {m.ready ? <Check className="size-3.5" aria-hidden /> : null}
                {m.ready ? 'Ready' : 'Not ready'}
              </span>
              {isHost && m.playerId !== view.you.playerId && <MemberMenu name={m.name} offline={!m.connected} onRemove={() => send('lobby:remove', { playerId: m.playerId })} onTransfer={() => send('lobby:transfer', { playerId: m.playerId })} />}
            </li>
          ))}
        </ul>
        {spectators.length > 0 && <p className="mt-3 text-sm text-parchment/60">Watching: {spectators.map((s) => s.name).join(', ')}</p>}
      </section>

      <RolesSummary view={view} />
      {isHost && <HostSettings view={view} send={send} />}
      {blocker && isHost && (
        <p className="text-sm text-parchment/70" id="start-blocker">
          {blocker}
        </p>
      )}
    </div>
  );
}

function MemberMenu({ name, offline, onRemove, onTransfer }: { name: string; offline: boolean; onRemove: () => void; onTransfer: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Manage ${name}`}>
          <Settings2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription className="mt-1 text-parchment/70">{offline ? `${name} is offline. You can remove them so the game can start.` : 'Host actions for this player.'}</DialogDescription>
        <div className="mt-5 grid gap-3">
          <Button variant="secondary" onClick={onTransfer}>
            <Crown aria-hidden /> Make host
          </Button>
          <Button variant="treason" onClick={onRemove}>
            <UserMinus aria-hidden /> Remove from room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RolesSummary({ view }: { view: RoomView }) {
  const roles = ['MERLIN', 'ASSASSIN', ...view.settings.optionalRoles];
  return (
    <section aria-labelledby="roles-h" className="glass p-4">
      <h2 id="roles-h" className="mb-2 text-xl">
        Roles in play
      </h2>
      <p className="text-parchment/80">{roles.map((r) => ROLE_COPY[r]?.name ?? r).join(', ')}, plus Loyal Servants and Minions to fill the table.</p>
      {view.configIssues
        .filter((i) => i.code !== 'TOO_FEW_PLAYERS')
        .map((i) => (
          <p key={i.code} role={i.severity === 'error' ? 'alert' : undefined} className={cn('mt-2 text-sm', i.severity === 'error' ? 'text-treason-soft' : 'text-gilt')}>
            {i.message}
          </p>
        ))}
    </section>
  );
}

const ROLE_HINT: Record<string, string> = {
  PERCIVAL: 'Good. Sees who might be Merlin.',
  MORGANA: 'Evil. Looks like Merlin to Percival.',
  MORDRED: 'Evil. Hidden from Merlin.',
  OBERON: 'Evil. Works alone, unseen by allies.',
};

function HostSettings({ view, send }: { view: RoomView; send: Send }) {
  const s = view.settings;
  const [error, setError] = useState<string | null>(null);
  const update = async (patch: Partial<RoomSettings>) => {
    const r = await send('lobby:settings', patch);
    setError(r.ok ? null : (r.message ?? 'Could not save that setting.'));
  };
  const toggleRole = (id: string, on: boolean) => update({ optionalRoles: on ? [...s.optionalRoles, id] : s.optionalRoles.filter((r) => r !== id) });

  const row = (id: string, label: string, hint: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div key={id} className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-parchment/60">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <section aria-labelledby="settings-h" className="glass p-4">
      <h2 id="settings-h" className="text-xl">
        Game setup
      </h2>
      <p className="mb-2 text-sm text-parchment/60">Only you can change these. Changing roles asks everyone to get ready again.</p>
      <div className="divide-y divide-white/[0.05]">
        {view.availableOptionalRoles.map((id) => row(`role-${id}`, ROLE_COPY[id]?.name ?? id, ROLE_HINT[id] ?? '', s.optionalRoles.includes(id), (v) => toggleRole(id, v)))}
      </div>
      <h3 className="mt-5 text-lg">Table options</h3>
      <div className="divide-y divide-white/[0.05]">
        {row('opt-listed', 'List on the home screen', 'Anyone visiting the site can see this table and join without the code.', s.listed, (v) => update({ listed: v }))}
        {row('opt-tutorial', 'Guided tips', 'Extra explanations at each step for new players.', s.tutorial, (v) => update({ tutorial: v }))}
        {row('opt-timers', 'Discussion timer', 'Shows a countdown while the leader picks a team. It never acts on its own.', s.timersEnabled, (v) => update({ timersEnabled: v }))}
        {s.timersEnabled && (
          <div className="flex items-center justify-between gap-4 py-3">
            <label htmlFor="opt-timer-len" className="font-medium">
              Timer length
            </label>
            <select
              id="opt-timer-len"
              className="h-11 rounded-md border border-night-line bg-night-deep px-3"
              value={s.timerSeconds}
              onChange={(e) => update({ timerSeconds: Number(e.target.value) })}
            >
              {[60, 120, 180, 300, 600].map((v) => (
                <option key={v} value={v}>
                  {v / 60} min
                </option>
              ))}
            </select>
          </div>
        )}
        {row('opt-chat', 'Text chat', 'For groups not sharing a room or a call.', s.chatEnabled, (v) => update({ chatEnabled: v }))}
        {row('opt-spectators', 'Allow spectators', 'Watchers see only public information.', s.allowSpectators, (v) => update({ allowSpectators: v }))}
        {row('opt-reveal', 'Reveal roles at the end', 'Show everyone’s role on the game-over screen.', s.revealRolesAtEnd, (v) => update({ revealRolesAtEnd: v }))}
        {row(
          'opt-assassin',
          'Assassin may target anyone',
          'Off: the Assassin cannot pick players they already know are Evil. On: any other player.',
          s.assassinationTargets === 'ANY_OTHER_PLAYER',
          (v) => update({ assassinationTargets: v ? 'ANY_OTHER_PLAYER' : 'NOT_KNOWN_EVIL' }),
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-treason-soft">
          {error}
        </p>
      )}
    </section>
  );
}
