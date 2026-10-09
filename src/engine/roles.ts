import type { Alignment, KnowledgeLabel, RoleId } from './types';

/**
 * Data-driven role system.
 *
 * Visibility works through tags. A role *carries* tags (how it appears to
 * others) and declares which tags it *sees* (and with what label). The engine
 * never special-cases a role by id for knowledge; it only evaluates these rules.
 * Adding a new role means adding an entry here (and, if needed, new tags).
 *
 * Display names and descriptions live in `src/lib/branding.ts` so the visual
 * identity can be swapped without touching the engine.
 */

export type RoleTag =
  | 'VISIBLE_TO_EVIL'
  | 'VISIBLE_TO_MERLIN'
  | 'MERLIN_CANDIDATE'
  | 'ASSASSINATION_TARGET';

export type RoleAbility = 'ASSASSINATE';

export interface SightRule {
  tag: RoleTag;
  appearsAs: KnowledgeLabel;
}

export interface RoleDefinition {
  id: RoleId;
  alignment: Alignment;
  /** Filler roles may appear many times; special roles at most once. */
  kind: 'FILLER' | 'REQUIRED' | 'OPTIONAL';
  tags: RoleTag[];
  sees: SightRule[];
  abilities: RoleAbility[];
  /** Whether this role may play a FAIL quest card. */
  canFail: boolean;
  /** Optional roles that must also be enabled for this one to make sense. Produces a warning, not an error. */
  recommendedWith?: RoleId[];
}

const evilSight: SightRule[] = [{ tag: 'VISIBLE_TO_EVIL', appearsAs: 'EVIL' }];

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  MERLIN: {
    id: 'MERLIN',
    alignment: 'GOOD',
    kind: 'REQUIRED',
    tags: ['MERLIN_CANDIDATE', 'ASSASSINATION_TARGET'],
    sees: [{ tag: 'VISIBLE_TO_MERLIN', appearsAs: 'EVIL' }],
    abilities: [],
    canFail: false,
  },
  LOYAL_SERVANT: {
    id: 'LOYAL_SERVANT',
    alignment: 'GOOD',
    kind: 'FILLER',
    tags: [],
    sees: [],
    abilities: [],
    canFail: false,
  },
  PERCIVAL: {
    id: 'PERCIVAL',
    alignment: 'GOOD',
    kind: 'OPTIONAL',
    tags: [],
    sees: [{ tag: 'MERLIN_CANDIDATE', appearsAs: 'MERLIN_OR_MORGANA' }],
    abilities: [],
    canFail: false,
    recommendedWith: ['MORGANA'],
  },
  ASSASSIN: {
    id: 'ASSASSIN',
    alignment: 'EVIL',
    kind: 'REQUIRED',
    tags: ['VISIBLE_TO_EVIL', 'VISIBLE_TO_MERLIN'],
    sees: evilSight,
    abilities: ['ASSASSINATE'],
    canFail: true,
  },
  MINION: {
    id: 'MINION',
    alignment: 'EVIL',
    kind: 'FILLER',
    tags: ['VISIBLE_TO_EVIL', 'VISIBLE_TO_MERLIN'],
    sees: evilSight,
    abilities: [],
    canFail: true,
  },
  MORGANA: {
    id: 'MORGANA',
    alignment: 'EVIL',
    kind: 'OPTIONAL',
    tags: ['VISIBLE_TO_EVIL', 'VISIBLE_TO_MERLIN', 'MERLIN_CANDIDATE'],
    sees: evilSight,
    abilities: [],
    canFail: true,
    recommendedWith: ['PERCIVAL'],
  },
  MORDRED: {
    id: 'MORDRED',
    alignment: 'EVIL',
    kind: 'OPTIONAL',
    // Deliberately lacks VISIBLE_TO_MERLIN.
    tags: ['VISIBLE_TO_EVIL'],
    sees: evilSight,
    abilities: [],
    canFail: true,
  },
  OBERON: {
    id: 'OBERON',
    alignment: 'EVIL',
    kind: 'OPTIONAL',
    // Lacks VISIBLE_TO_EVIL, and sees nothing.
    tags: ['VISIBLE_TO_MERLIN'],
    sees: [],
    abilities: [],
    canFail: true,
  },
};

export const GOOD_FILLER: RoleId = 'LOYAL_SERVANT';
export const EVIL_FILLER: RoleId = 'MINION';

export function getRole(id: RoleId): RoleDefinition {
  const role = ROLE_DEFINITIONS[id];
  if (!role) throw new Error(`Unknown role id`);
  return role;
}

export function requiredRoleIds(): RoleId[] {
  return Object.values(ROLE_DEFINITIONS)
    .filter((r) => r.kind === 'REQUIRED')
    .map((r) => r.id);
}

export function optionalRoleIds(): RoleId[] {
  return Object.values(ROLE_DEFINITIONS)
    .filter((r) => r.kind === 'OPTIONAL')
    .map((r) => r.id);
}
