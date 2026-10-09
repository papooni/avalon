'use client';
import type { PrivatePlayerState } from '@/engine';
import { BRAND, KNOWLEDGE_COPY, ROLE_COPY } from '@/lib/branding';
import { cn } from '@/lib/utils';
import type { PublicMember } from '@/server/rooms';
import { AvatarGlyph, RoleSigil } from './Art';
import { PrivateReveal } from './PrivateReveal';

export function RoleReveal({ me, onContinue }: { me: PrivatePlayerState; onContinue: () => void }) {
  const copy = ROLE_COPY[me.roleId]!;
  const good = me.alignment === 'GOOD';
  return (
    <PrivateReveal title="Your secret role" warning="Only you should see the next screen. Turn your phone away from others before you reveal." onContinue={onContinue} continued={me.hasAcknowledged}>
      <div className="space-y-4 text-center">
        <RoleSigil roleId={me.roleId} alignment={me.alignment} className="mx-auto size-28" />
        <p className={cn('text-sm font-medium', good ? 'text-loyal-soft' : 'text-treason-soft')}>
          {good ? '◯' : '◇'} You are {BRAND.team[me.alignment]}
        </p>
        <h2 className="text-4xl" data-testid="role-name">
          {copy.name}
        </h2>
        <p className="text-lg">{copy.summary}</p>
        <p className="text-sm text-parchment/70">{copy.advice}</p>
      </div>
    </PrivateReveal>
  );
}

export function KnowledgeReveal({ me, members, onContinue }: { me: PrivatePlayerState; members: PublicMember[]; onContinue: () => void }) {
  const byId = new Map(members.map((m) => [m.playerId, m]));
  const intro: Record<string, string> = {
    MERLIN: 'These players are Evil. One traitor may be hidden from you.',
    PERCIVAL: 'One of these is Merlin. If Morgana is in the game, the other is her.',
    ASSASSIN: 'These players are your fellow traitors.',
    MINION: 'These players are your fellow traitors.',
    MORGANA: 'These players are your fellow traitors.',
    MORDRED: 'These players are your fellow traitors.',
  };
  return (
    <PrivateReveal title="What you know" warning="This screen shows secret information about other players. Keep it hidden." onContinue={onContinue} continued={me.hasAcknowledged} continueLabel="Got it">
      <div className="space-y-4" data-testid="knowledge">
        {me.knowledge.length === 0 ? (
          <div className="space-y-2 text-center">
            <h2 className="text-2xl">You see no one</h2>
            <p className="text-parchment/75">
              {me.roleId === 'OBERON' ? 'You serve Evil, but you do not know your allies and they do not know you.' : 'Your role gives you no secret knowledge. Watch and listen.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-center text-parchment/80">{intro[me.roleId] ?? 'You know the following:'}</p>
            <ul className="space-y-2">
              {me.knowledge.map((k) => {
                const m = byId.get(k.playerId);
                const evil = k.label === 'EVIL';
                return (
                  <li key={k.playerId} className="flex items-center gap-3 rounded-md border border-night-line bg-night-deep/60 px-3 py-2">
                    <AvatarGlyph avatar={m?.avatar ?? 'oak'} />
                    <span className="flex-1 font-medium">{m?.name ?? 'A player'}</span>
                    <span className={cn('rounded-full px-2.5 py-1 text-sm', evil ? 'bg-treason/25 text-treason-soft' : 'bg-gilt/15 text-gilt')}>
                      {evil ? '◇ ' : '✶ '}
                      {KNOWLEDGE_COPY[k.label]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </PrivateReveal>
  );
}
