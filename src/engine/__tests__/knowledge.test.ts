import { describe, expect, it } from 'vitest';
import { knowledgeFor } from '../index';
import { playerWithRole, startedGame } from './helpers';

// Seats p1..p10 receive these roles in order.
const FULL10 = ['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON'];
const cfg = { optionalRoles: ['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'] };

const ids = (k: { playerId: string }[]) => k.map((x) => x.playerId).sort();

describe('role knowledge', () => {
  const s = startedGame(10, cfg, FULL10);

  it('Merlin sees Evil except Mordred, and does see Oberon', () => {
    const k = knowledgeFor(s, playerWithRole(s, 'MERLIN'));
    expect(ids(k)).toEqual(['p10', 'p7', 'p8'].sort()); // Assassin, Morgana, Oberon
    expect(k.every((e) => e.label === 'EVIL')).toBe(true);
    expect(ids(k)).not.toContain(playerWithRole(s, 'MORDRED'));
  });

  it('Percival sees Merlin and Morgana with an identical label', () => {
    const k = knowledgeFor(s, playerWithRole(s, 'PERCIVAL'));
    expect(ids(k)).toEqual(['p1', 'p8']);
    expect(new Set(k.map((e) => e.label))).toEqual(new Set(['MERLIN_OR_MORGANA']));
  });

  it('Percival without Morgana sees only Merlin', () => {
    const s2 = startedGame(6, { optionalRoles: ['PERCIVAL'] }, ['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']);
    expect(ids(knowledgeFor(s2, 'p2'))).toEqual(['p1']);
  });

  it('Visible Evil players see each other but not Oberon', () => {
    for (const role of ['ASSASSIN', 'MORGANA', 'MORDRED']) {
      const me = playerWithRole(s, role);
      const k = knowledgeFor(s, me);
      const expected = ['p7', 'p8', 'p9'].filter((p) => p !== me).sort();
      expect(ids(k)).toEqual(expected);
      expect(ids(k)).not.toContain('p10');
      expect(k.every((e) => e.label === 'EVIL')).toBe(true);
    }
  });

  it('Oberon sees nobody', () => {
    expect(knowledgeFor(s, playerWithRole(s, 'OBERON'))).toEqual([]);
  });

  it('Loyal Servants see nobody', () => {
    expect(knowledgeFor(s, 'p3')).toEqual([]);
  });

  it('Minions see each other and the Assassin in the base game', () => {
    const s3 = startedGame(7, {}, ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION', 'MINION']);
    expect(ids(knowledgeFor(s3, 'p6'))).toEqual(['p5', 'p7']);
    expect(ids(knowledgeFor(s3, 'p1'))).toEqual(['p5', 'p6', 'p7']);
  });

  it('no one ever learns their own role through knowledge', () => {
    for (const p of s.players) expect(ids(knowledgeFor(s, p))).not.toContain(p);
  });
});
