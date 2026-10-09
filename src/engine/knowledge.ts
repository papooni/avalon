import { getRole } from './roles';
import type { GameState, KnowledgeLabel, PlayerId } from './types';

export interface KnowledgeEntry {
  playerId: PlayerId;
  label: KnowledgeLabel;
}

/**
 * What `playerId` learns about other players at the start of the game.
 * Purely derived from role tags and sight rules, so new roles need no code here.
 */
export function knowledgeFor(state: GameState, playerId: PlayerId): KnowledgeEntry[] {
  const myRoleId = state.roles[playerId];
  if (!myRoleId) return [];
  const me = getRole(myRoleId);
  if (me.sees.length === 0) return [];

  const entries: KnowledgeEntry[] = [];
  for (const other of state.players) {
    if (other === playerId) continue;
    const otherRoleId = state.roles[other];
    if (!otherRoleId) continue;
    const otherRole = getRole(otherRoleId);
    const rule = me.sees.find((r) => otherRole.tags.includes(r.tag));
    if (rule) entries.push({ playerId: other, label: rule.appearsAs });
  }
  return entries;
}

/** Players `playerId` knows to be Evil (used for the assassination target policy). */
export function knownEvilFor(state: GameState, playerId: PlayerId): Set<PlayerId> {
  return new Set(
    knowledgeFor(state, playerId)
      .filter((k) => k.label === 'EVIL')
      .map((k) => k.playerId),
  );
}
