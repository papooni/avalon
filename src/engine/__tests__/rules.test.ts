import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  PLAYER_COUNT_RULES,
  buildRoleDeck,
  createGame,
  getRole,
  hasBlockingIssues,
  seededRng,
  validateConfig,
  DEFAULT_CONFIG,
} from '../index';
import { cid, mustApply, playersN, sys } from './helpers';

const expected: Record<number, { good: number; evil: number; sizes: number[] }> = {
  5: { good: 3, evil: 2, sizes: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, sizes: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, sizes: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, sizes: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, sizes: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, sizes: [3, 4, 4, 5, 5] },
};

describe('player distributions and quest sizes', () => {
  for (let n = 5; n <= 10; n++) {
    it(`${n} players: distribution, quest sizes, fail thresholds`, () => {
      const r = PLAYER_COUNT_RULES[n]!;
      expect(r.good).toBe(expected[n]!.good);
      expect(r.evil).toBe(expected[n]!.evil);
      expect(r.good + r.evil).toBe(n);
      expect(r.questSizes).toEqual(expected[n]!.sizes);
      expect(r.failsRequired).toEqual(n >= 7 ? [1, 1, 1, 2, 1] : [1, 1, 1, 1, 1]);
    });

    it(`${n} players: dealt roles match the distribution across many seeds`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        let s = createGame('g', playersN(n), { optionalRoles: [] });
        s = mustApply(s, { type: 'START_GAME', commandId: cid() }, sys, seededRng(seed));
        const roles = Object.values(s.roles);
        expect(roles.length).toBe(n);
        expect(roles.filter((id) => getRole(id).alignment === 'GOOD').length).toBe(expected[n]!.good);
        expect(roles.filter((id) => getRole(id).alignment === 'EVIL').length).toBe(expected[n]!.evil);
        expect(roles.filter((id) => id === 'MERLIN').length).toBe(1);
        expect(roles.filter((id) => id === 'ASSASSIN').length).toBe(1);
        expect(s.quests.map((q) => q.size)).toEqual(expected[n]!.sizes);
      }
    });
  }

  it('builds a full deck with every optional role at 10 players', () => {
    const deck = buildRoleDeck({ ...DEFAULT_CONFIG, optionalRoles: ['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'] }, 10);
    expect(deck.sort()).toEqual(
      ['ASSASSIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'MERLIN', 'MORDRED', 'MORGANA', 'OBERON', 'PERCIVAL'].sort(),
    );
  });
});

describe('configuration validation', () => {
  const cfg = (optionalRoles: string[]) => ({ ...DEFAULT_CONFIG, optionalRoles });

  it('rejects fewer than 5 and more than 10 players', () => {
    expect(hasBlockingIssues(validateConfig(cfg([]), 4))).toBe(true);
    expect(hasBlockingIssues(validateConfig(cfg([]), 11))).toBe(true);
  });

  it('accepts the base game at every count', () => {
    for (let n = 5; n <= 10; n++) expect(hasBlockingIssues(validateConfig(cfg([]), n))).toBe(false);
  });

  it('rejects more Evil specials than Evil seats', () => {
    // 5 players: 2 evil seats, Assassin + Morgana + Mordred = 3.
    const issues = validateConfig(cfg(['MORGANA', 'MORDRED']), 5);
    expect(issues.find((i) => i.code === 'TOO_MANY_EVIL_ROLES')).toBeTruthy();
    expect(hasBlockingIssues(validateConfig(cfg(['MORGANA', 'MORDRED', 'OBERON']), 7))).toBe(true);
    expect(hasBlockingIssues(validateConfig(cfg(['MORGANA', 'MORDRED', 'OBERON']), 10))).toBe(false);
  });

  it('rejects duplicate, unknown and non-optional roles', () => {
    expect(validateConfig(cfg(['MORGANA', 'MORGANA']), 7).some((i) => i.code === 'DUPLICATE_ROLE')).toBe(true);
    expect(validateConfig(cfg(['DRAGON']), 7).some((i) => i.code === 'UNKNOWN_ROLE')).toBe(true);
    expect(validateConfig(cfg(['MERLIN']), 7).some((i) => i.code === 'NOT_OPTIONAL')).toBe(true);
    expect(validateConfig(cfg(['MINION']), 7).some((i) => i.code === 'NOT_OPTIONAL')).toBe(true);
  });

  it('warns (but allows) Percival without Morgana and vice versa', () => {
    const a = validateConfig(cfg(['PERCIVAL']), 6);
    expect(hasBlockingIssues(a)).toBe(false);
    expect(a.some((i) => i.severity === 'warning')).toBe(true);
    const b = validateConfig(cfg(['MORGANA']), 6);
    expect(b.some((i) => i.severity === 'warning')).toBe(true);
  });

  it('START_GAME is refused with a friendly message for invalid config', () => {
    const s = createGame('g', playersN(5), { optionalRoles: ['MORGANA', 'MORDRED'] });
    const r = mustApplyResult(s);
    expect(r.ok).toBe(false);
  });
});

function mustApplyResult(s: ReturnType<typeof createGame>) {
  return applyCommand(s, { type: 'START_GAME', commandId: cid() }, sys, seededRng(1));
}
