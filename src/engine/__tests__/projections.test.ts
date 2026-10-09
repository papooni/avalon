import { describe, expect, it } from 'vitest';
import { getPrivatePlayerState, getPublicGameState, type GameState } from '../index';
import { ackAll, as, cid, mustApply, playQuest, propose, startedGame, toTeamProposal, voteAll } from './helpers';

const ROLES = ['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON'];
const ROLE_IDS = ['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON', 'MINION'];
const cfg = { optionalRoles: ['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'], revealRolesAtEnd: true };

/** Removes the optionalRoles list, which is public table configuration, before scanning for role leaks. */
function publicJsonWithoutConfig(s: GameState): string {
  const pub = getPublicGameState(s) as unknown as Record<string, unknown>;
  const { optionalRoles: _o, ...rest } = pub;
  return JSON.stringify(rest);
}

function assertNoRoleLeak(s: GameState) {
  const json = publicJsonWithoutConfig(s);
  for (const id of ROLE_IDS) expect(json.includes(`"${id}"`)).toBe(false);
  expect(json).not.toContain('pendingVotes');
  expect(json).not.toContain('pendingQuestCards');
  expect(json).not.toContain('roles');
}

describe('public projection never leaks hidden information', () => {
  it('in every phase before GAME_OVER', () => {
    let s = startedGame(10, cfg, ROLES);
    assertNoRoleLeak(s);
    s = toTeamProposal(s);
    assertNoRoleLeak(s);
    s = propose(s, ['p1', 'p2', 'p3']);
    s = mustApply(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: false }, as('p1'));
    assertNoRoleLeak(s);
    const mid = getPublicGameState(s);
    expect(mid.votedPlayerIds).toEqual(['p1']);
    expect(mid.proposals.at(-1)!.votes).toBeNull();
  });

  it('exposes quest totals but not who played which card', () => {
    let s = toTeamProposal(startedGame(10, cfg, ROLES));
    s = ackAll(voteAll(propose(s, ['p7', 'p1', 'p2']), 10));
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'FAIL' }, as('p7'));
    const during = getPublicGameState(s);
    expect(during.questCardsPlayed).toBe(1);
    expect(JSON.stringify(during)).not.toContain('FAIL');
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p1'));
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p2'));
    const after = getPublicGameState(s);
    expect(after.quests[0]!.failCount).toBe(1);
    expect(after.quests[0]!.revealedCards.length).toBe(3);
    assertNoRoleLeak(s);
  });

  it('reveals roles at GAME_OVER only when configured', () => {
    let s = toTeamProposal(startedGame(5, { revealRolesAtEnd: false }, ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    for (let i = 0; i < 5; i++) s = ackAll(voteAll(propose(s), 0));
    expect(s.phase).toBe('GAME_OVER');
    expect(getPublicGameState(s).finalRoles).toBeNull();
    let t = toTeamProposal(startedGame(5, { revealRolesAtEnd: true }, ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    for (let i = 0; i < 5; i++) t = ackAll(voteAll(propose(t), 0));
    expect(getPublicGameState(t).finalRoles).not.toBeNull();
  });
});

describe('private projection', () => {
  const s = startedGame(10, cfg, ROLES);

  it('contains only the viewer’s own role', () => {
    for (const p of s.players) {
      const priv = getPrivatePlayerState(s, p)!;
      const json = JSON.stringify(priv);
      const otherRoles = ROLE_IDS.filter((r) => r !== priv.roleId);
      for (const r of otherRoles) expect(json.includes(`"${r}"`)).toBe(false);
    }
  });

  it('Percival’s view cannot distinguish Merlin from Morgana', () => {
    const priv = getPrivatePlayerState(s, 'p2')!;
    expect(priv.knowledge.map((k) => k.label)).toEqual(['MERLIN_OR_MORGANA', 'MERLIN_OR_MORGANA']);
  });

  it('refuses to project for a non-seated player (spectator or attacker)', () => {
    expect(() => getPrivatePlayerState(s, 'spectator')).toThrow();
  });

  it('shows the viewer only their own pending vote', () => {
    let t = propose(toTeamProposal(s), ['p1', 'p2', 'p3']);
    t = mustApply(t, { type: 'CAST_VOTE', commandId: cid(), stepId: t.stepId, approve: false }, as('p1'));
    expect(getPrivatePlayerState(t, 'p1')!.myPendingVote).toBe(false);
    expect(getPrivatePlayerState(t, 'p2')!.myPendingVote).toBeNull();
    expect(JSON.stringify(getPrivatePlayerState(t, 'p2'))).not.toContain('p1":false');
  });

  it('assassination candidates are only given to the Assassin, in the assassination phase', () => {
    let t = toTeamProposal(startedGame(5, {}, ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    t = playQuest(t, 0, ['p1', 'p2']);
    t = playQuest(t, 0, ['p1', 'p2', 'p3']);
    t = playQuest(t, 0, ['p1', 'p2']);
    expect(t.phase).toBe('ASSASSINATION');
    expect(getPrivatePlayerState(t, 'p4')!.assassinationCandidates.sort()).toEqual(['p1', 'p2', 'p3']);
    expect(getPrivatePlayerState(t, 'p5')!.assassinationCandidates).toEqual([]);
    expect(getPrivatePlayerState(t, 'p1')!.assassinationCandidates).toEqual([]);
  });
});
