import { EVIL_FILLER, GOOD_FILLER, ROLE_DEFINITIONS, requiredRoleIds } from './roles';
import type { GameConfig, RoleId } from './types';

/**
 * Rule tables. Every row is verified in docs/rule-matrix.md with sources.
 * Rule IDs in comments refer to that document.
 */

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const QUESTS_TO_WIN = 3; // R-WIN-1, R-WIN-2
export const MAX_CONSECUTIVE_REJECTIONS = 5; // R-VOTE-5

export interface PlayerCountRules {
  good: number;
  evil: number;
  questSizes: [number, number, number, number, number];
  /** Number of FAIL cards needed to fail each quest. */
  failsRequired: [number, number, number, number, number];
}

// R-DIST-*, R-QUEST-SIZE-*, R-QUEST-FAIL-*
export const PLAYER_COUNT_RULES: Record<number, PlayerCountRules> = {
  5: { good: 3, evil: 2, questSizes: [2, 3, 2, 3, 3], failsRequired: [1, 1, 1, 1, 1] },
  6: { good: 4, evil: 2, questSizes: [2, 3, 4, 3, 4], failsRequired: [1, 1, 1, 1, 1] },
  7: { good: 4, evil: 3, questSizes: [2, 3, 3, 4, 4], failsRequired: [1, 1, 1, 2, 1] },
  8: { good: 5, evil: 3, questSizes: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
  9: { good: 6, evil: 3, questSizes: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
  10: { good: 6, evil: 4, questSizes: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
};

export function rulesFor(playerCount: number): PlayerCountRules {
  const rules = PLAYER_COUNT_RULES[playerCount];
  if (!rules) {
    throw new Error(`Avalon supports ${MIN_PLAYERS}–${MAX_PLAYERS} players.`);
  }
  return rules;
}

export const DEFAULT_CONFIG: GameConfig = {
  optionalRoles: [],
  assassinationTargets: 'NOT_KNOWN_EVIL',
  revealRolesAtEnd: true,
};

export interface ConfigIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

/**
 * Validates a role configuration for a given player count. Errors block the
 * game from starting; warnings are shown to the host but allowed.
 */
export function validateConfig(config: GameConfig, playerCount: number): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (playerCount < MIN_PLAYERS) {
    issues.push({
      severity: 'error',
      code: 'TOO_FEW_PLAYERS',
      message: `You need at least ${MIN_PLAYERS} players. Waiting for ${MIN_PLAYERS - playerCount} more.`,
    });
  }
  if (playerCount > MAX_PLAYERS) {
    issues.push({
      severity: 'error',
      code: 'TOO_MANY_PLAYERS',
      message: `A game holds at most ${MAX_PLAYERS} players. Move ${playerCount - MAX_PLAYERS} to spectators.`,
    });
  }

  const seen = new Set<RoleId>();
  for (const id of config.optionalRoles) {
    const def = ROLE_DEFINITIONS[id];
    if (!def) {
      issues.push({ severity: 'error', code: 'UNKNOWN_ROLE', message: 'One of the selected roles is not supported.' });
      continue;
    }
    if (def.kind !== 'OPTIONAL') {
      issues.push({
        severity: 'error',
        code: 'NOT_OPTIONAL',
        message: 'Required and filler roles are added automatically and cannot be toggled.',
      });
    }
    if (seen.has(id)) {
      issues.push({ severity: 'error', code: 'DUPLICATE_ROLE', message: 'Each special role can only be used once.' });
    }
    seen.add(id);
  }

  if (playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS) {
    const { good, evil } = rulesFor(playerCount);
    const special = [...requiredRoleIds(), ...seen].map((id) => ROLE_DEFINITIONS[id]).filter(Boolean);
    const specialGood = special.filter((r) => r!.alignment === 'GOOD').length;
    const specialEvil = special.filter((r) => r!.alignment === 'EVIL').length;
    if (specialEvil > evil) {
      issues.push({
        severity: 'error',
        code: 'TOO_MANY_EVIL_ROLES',
        message: `A ${playerCount}-player game has ${evil} Evil seats, and the Assassin always takes one. Turn off ${specialEvil - evil} Evil role${specialEvil - evil > 1 ? 's' : ''}.`,
      });
    }
    if (specialGood > good) {
      issues.push({
        severity: 'error',
        code: 'TOO_MANY_GOOD_ROLES',
        message: `A ${playerCount}-player game has only ${good} Good seats. Turn off ${specialGood - good} Good role${specialGood - good > 1 ? 's' : ''}.`,
      });
    }
  }

  for (const id of seen) {
    const def = ROLE_DEFINITIONS[id];
    for (const partner of def?.recommendedWith ?? []) {
      if (!seen.has(partner)) {
        issues.push({
          severity: 'warning',
          code: `RECOMMENDED_${id}_${partner}`,
          message:
            id === 'PERCIVAL'
              ? 'Percival without Morgana simply learns who Merlin is, which strongly favours Good.'
              : 'Morgana without Percival has no one to confuse. She plays like an ordinary Evil player.',
        });
      }
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: ConfigIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/** Builds the multiset of roles for a game (before shuffling). */
export function buildRoleDeck(config: GameConfig, playerCount: number): RoleId[] {
  const { good, evil } = rulesFor(playerCount);
  const special = [...requiredRoleIds(), ...config.optionalRoles];
  const goodSpecial = special.filter((id) => ROLE_DEFINITIONS[id]!.alignment === 'GOOD');
  const evilSpecial = special.filter((id) => ROLE_DEFINITIONS[id]!.alignment === 'EVIL');
  return [
    ...goodSpecial,
    ...Array<RoleId>(good - goodSpecial.length).fill(GOOD_FILLER),
    ...evilSpecial,
    ...Array<RoleId>(evil - evilSpecial.length).fill(EVIL_FILLER),
  ];
}
