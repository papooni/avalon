/**
 * All player-facing names for roles and teams live here, separate from the
 * engine. Swap this file to re-skin the game with original branding.
 */
import type { Alignment, KnowledgeLabel, RoleId } from '@/engine';

export const BRAND = {
  productName: 'Avalon Night',
  tagline: 'A game of hidden loyalties for five to ten players.',
  team: { GOOD: 'Good', EVIL: 'Evil' } satisfies Record<Alignment, string>,
  teamMembers: { GOOD: 'the loyal', EVIL: 'the traitors' } satisfies Record<Alignment, string>,
  questWord: 'quest',
};

export interface RoleCopy {
  name: string;
  /** One line shown on the reveal card. */
  summary: string;
  /** What the player should do with their knowledge. */
  advice: string;
}

export const ROLE_COPY: Record<RoleId, RoleCopy> = {
  MERLIN: {
    name: 'Merlin',
    summary: 'You know most of the traitors.',
    advice: 'Steer the table toward safe teams without making it obvious. If Evil identifies you at the end, they win.',
  },
  PERCIVAL: {
    name: 'Percival',
    summary: 'You can see who might be Merlin.',
    advice: 'One of the players shown is Merlin; the other may be Morgana in disguise. Protect the real one.',
  },
  LOYAL_SERVANT: {
    name: 'Loyal Servant',
    summary: 'You know nothing for certain.',
    advice: 'Watch votes and quest results closely. Trust is earned through consistent choices.',
  },
  ASSASSIN: {
    name: 'Assassin',
    summary: 'You serve Evil, and you hold the final blade.',
    advice: 'If Good completes three quests, you choose one player. If it is Merlin, Evil wins.',
  },
  MINION: {
    name: 'Minion of Evil',
    summary: 'You serve Evil alongside your allies.',
    advice: 'Sabotage quests when it is safe, and help the Assassin work out who Merlin is.',
  },
  MORGANA: {
    name: 'Morgana',
    summary: 'You serve Evil, and Percival may mistake you for Merlin.',
    advice: 'Act like someone with secret knowledge so Percival protects you instead of Merlin.',
  },
  MORDRED: {
    name: 'Mordred',
    summary: 'You serve Evil, hidden even from Merlin.',
    advice: 'Merlin cannot see you. Use that freedom to earn trust and get onto quests.',
  },
  OBERON: {
    name: 'Oberon',
    summary: 'You serve Evil, but alone.',
    advice: 'You do not know the other traitors and they do not know you. Find each other through play.',
  },
};

export const KNOWLEDGE_COPY: Record<KnowledgeLabel, string> = {
  EVIL: 'Evil',
  MERLIN_OR_MORGANA: 'Merlin or Morgana',
};

export function roleName(id: RoleId): string {
  return ROLE_COPY[id]?.name ?? id;
}
