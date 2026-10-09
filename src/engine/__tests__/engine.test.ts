import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, seededRng, TRANSITIONS, COMMANDS_BY_PHASE, type GameState } from '../index';
import { ackAll, as, cid, leader, mustApply, playQuest, playerWithRole, propose, startedGame, sys, toTeamProposal, voteAll } from './helpers';

const BASE5 = ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION'];
const BASE7 = ['ASSASSIN', 'MINION', 'MINION', 'MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT'];
const rng = seededRng(3);

function game5(): GameState {
  return toTeamProposal(startedGame(5, {}, BASE5));
}

describe('phase flow', () => {
  it('starts in LOBBY and moves through reveal phases to TEAM_PROPOSAL', () => {
    let s = createGame('g', ['a', 'b', 'c', 'd', 'e']);
    expect(s.phase).toBe('LOBBY');
    s = mustApply(s, { type: 'START_GAME', commandId: cid() }, sys);
    expect(s.phase).toBe('ROLE_REVEAL');
    s = ackAll(s);
    expect(s.phase).toBe('KNOWLEDGE_REVEAL');
    s = ackAll(s);
    expect(s.phase).toBe('TEAM_PROPOSAL');
  });

  it('a partial set of acknowledgements does not advance; ADVANCE from the server does', () => {
    let s = startedGame(5, {}, BASE5);
    s = mustApply(s, { type: 'ACKNOWLEDGE', commandId: cid(), stepId: s.stepId }, as('p1'));
    expect(s.phase).toBe('ROLE_REVEAL');
    s = mustApply(s, { type: 'ADVANCE', commandId: cid(), stepId: s.stepId }, sys);
    expect(s.phase).toBe('KNOWLEDGE_REVEAL');
  });

  it('only the server may START_GAME or ADVANCE', () => {
    const lobby = createGame('g', ['a', 'b', 'c', 'd', 'e']);
    const r = applyCommand(lobby, { type: 'START_GAME', commandId: cid() }, as('a'), rng);
    expect(r.ok).toBe(false);
    const s = startedGame(5, {}, BASE5);
    const r2 = applyCommand(s, { type: 'ADVANCE', commandId: cid(), stepId: s.stepId }, as('p1'), rng);
    expect(r2.ok && 'x').toBe(false);
  });

  it('the initial leader is random across seeds', () => {
    const leaders = new Set<number>();
    for (let seed = 1; seed < 60; seed++) leaders.add(startedGame(5, {}, undefined, seed).leaderIndex);
    expect(leaders.size).toBeGreaterThan(2);
  });

  it('every phase has a defined command set and transitions only to declared targets', () => {
    for (const phase of Object.keys(TRANSITIONS)) {
      expect(COMMANDS_BY_PHASE[phase as keyof typeof COMMANDS_BY_PHASE]).toBeDefined();
    }
    expect(TRANSITIONS.GAME_OVER).toEqual([]);
  });
});

describe('team proposal', () => {
  it('only the leader may propose', () => {
    const s = game5();
    const notLeader = s.players.find((p) => p !== leader(s))!;
    const r = applyCommand(s, { type: 'PROPOSE_TEAM', commandId: cid(), stepId: s.stepId, team: ['p1', 'p2'] }, as(notLeader), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('NOT_AUTHORIZED');
  });

  it('team must be exactly the required size, unique and seated', () => {
    const s = game5();
    const L = as(leader(s));
    const bad = [['p1'], ['p1', 'p2', 'p3'], ['p1', 'p1'], ['p1', 'ghost']];
    for (const team of bad) {
      const r = applyCommand(s, { type: 'PROPOSE_TEAM', commandId: cid(), stepId: s.stepId, team }, L, rng);
      expect(r.ok ? 'ok' : r.error.code).toBe('INVALID_TEAM');
    }
  });

  it('drafting does not change phase and is shared publicly', () => {
    const s = game5();
    const s2 = mustApply(s, { type: 'DRAFT_TEAM', commandId: cid(), stepId: s.stepId, team: ['p3'] }, as(leader(s)));
    expect(s2.phase).toBe('TEAM_PROPOSAL');
    expect(s2.draftTeam).toEqual(['p3']);
  });
});

describe('voting', () => {
  it('a strict majority approves (3 of 5)', () => {
    let s = propose(game5());
    s = voteAll(s, 3);
    expect(s.phase).toBe('VOTE_REVEAL');
    expect(s.proposals.at(-1)!.approved).toBe(true);
    s = ackAll(s);
    expect(s.phase).toBe('QUEST_ACTION');
  });

  it('a tie is rejected (3 of 6)', () => {
    let s = toTeamProposal(startedGame(6, {}, ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    s = voteAll(propose(s), 3);
    expect(s.proposals.at(-1)!.approved).toBe(false);
    expect(s.consecutiveRejections).toBe(1);
  });

  it('2 of 5 is rejected and leadership rotates in seat order', () => {
    let s = game5();
    const before = s.leaderIndex;
    s = ackAll(voteAll(propose(s), 2));
    expect(s.phase).toBe('TEAM_PROPOSAL');
    expect(s.leaderIndex).toBe((before + 1) % 5);
  });

  it('votes are hidden until everyone has voted, then all revealed at once', () => {
    let s = propose(game5());
    s = mustApply(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: false }, as('p1'));
    expect(s.proposals.at(-1)!.votes).toBeNull();
    expect(s.pendingVotes).toEqual({ p1: false });
    s = voteAllRemaining(s);
    expect(Object.keys(s.proposals.at(-1)!.votes!).length).toBe(5);
    expect(s.pendingVotes).toEqual({});
  });

  it('a player cannot vote twice', () => {
    let s = propose(game5());
    s = mustApply(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: true }, as('p1'));
    const r = applyCommand(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: false }, as('p1'), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('ALREADY_ACTED');
  });

  it('five consecutive rejections give Evil the win', () => {
    let s = game5();
    for (let i = 0; i < 4; i++) {
      s = ackAll(voteAll(propose(s), 0));
      expect(s.phase).toBe('TEAM_PROPOSAL');
      expect(s.consecutiveRejections).toBe(i + 1);
    }
    s = voteAll(propose(s), 0);
    expect(s.phase).toBe('VOTE_REVEAL');
    s = ackAll(s);
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).toBe('EVIL');
    expect(s.winReason).toBe('FIVE_REJECTIONS');
  });

  it('an approval resets the rejection counter', () => {
    let s = game5();
    for (let i = 0; i < 4; i++) s = ackAll(voteAll(propose(s), 0));
    expect(s.consecutiveRejections).toBe(4);
    s = voteAll(propose(s), 5);
    expect(s.consecutiveRejections).toBe(0);
  });
});

function voteAllRemaining(s: GameState): GameState {
  let state = s;
  for (const p of state.players) {
    if (p in state.pendingVotes) continue;
    state = mustApply(state, { type: 'CAST_VOTE', commandId: cid(), stepId: state.stepId, approve: true }, as(p));
  }
  return state;
}

function toQuestAction(s: GameState, team: string[]): GameState {
  return ackAll(voteAll(propose(s, team), s.players.length));
}

describe('quest actions', () => {
  it('Good players cannot play Fail', () => {
    const s = toQuestAction(game5(), ['p1', 'p2']); // Merlin, Servant
    const r = applyCommand(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'FAIL' }, as('p2'), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('CARD_NOT_ALLOWED');
  });

  it('players not on the team cannot play', () => {
    const s = toQuestAction(game5(), ['p1', 'p2']);
    const r = applyCommand(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p4'), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('NOT_ON_TEAM');
  });

  it('duplicate submissions are rejected', () => {
    let s = toQuestAction(game5(), ['p1', 'p4']);
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'FAIL' }, as('p4'));
    const r = applyCommand(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p4'), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('ALREADY_ACTED');
  });

  it('one Fail fails a normal quest; cards are shuffled and authors dropped', () => {
    let s = toQuestAction(game5(), ['p1', 'p4']);
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p1'));
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'FAIL' }, as('p4'));
    expect(s.phase).toBe('QUEST_REVEAL');
    const q = s.quests[0]!;
    expect(q.result).toBe('FAIL');
    expect(q.failCount).toBe(1);
    expect(q.successCount).toBe(1);
    expect(s.pendingQuestCards).toEqual({});
    expect(JSON.stringify(q.revealedCards)).not.toContain('p');
  });

  it('Evil may choose Success', () => {
    let s = toQuestAction(game5(), ['p4', 'p5']);
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p4'));
    s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'SUCCESS' }, as('p5'));
    expect(s.quests[0]!.result).toBe('SUCCESS');
  });

  describe('fourth quest two-Fail rule (7+ players)', () => {
    function toQuest4(n7: GameState): GameState {
      let s = n7;
      // Three quests: S, F, S (keeps the game alive). Team for fails includes evil p1..p3.
      s = playQuest(s, 0, ['p4', 'p5']);
      s = playQuest(s, 1, ['p1', 'p4', 'p5']);
      s = playQuest(s, 0, ['p4', 'p5', 'p6']);
      expect(s.questIndex).toBe(3);
      return s;
    }

    it('one Fail on quest 4 still succeeds', () => {
      let s = toQuest4(toTeamProposal(startedGame(7, {}, BASE7)));
      expect(s.quests[3]!.failsRequired).toBe(2);
      s = toQuestAction(s, ['p1', 'p4', 'p5', 'p6']);
      for (const p of ['p1', 'p4', 'p5', 'p6']) {
        s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: p === 'p1' ? 'FAIL' : 'SUCCESS' }, as(p));
      }
      expect(s.quests[3]!.result).toBe('SUCCESS');
      expect(s.quests[3]!.failCount).toBe(1);
    });

    it('two Fails on quest 4 fail it', () => {
      let s = toQuest4(toTeamProposal(startedGame(7, {}, BASE7)));
      s = toQuestAction(s, ['p1', 'p2', 'p4', 'p5']);
      for (const p of ['p1', 'p2', 'p4', 'p5']) {
        s = mustApply(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: p === 'p1' || p === 'p2' ? 'FAIL' : 'SUCCESS' }, as(p));
      }
      expect(s.quests[3]!.result).toBe('FAIL');
    });

    it('with 6 players, one Fail on quest 4 fails it', () => {
      const six = ['ASSASSIN', 'MINION', 'MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT'];
      let s = toTeamProposal(startedGame(6, {}, six));
      s = playQuest(s, 0, ['p3', 'p4']);
      s = playQuest(s, 1, ['p1', 'p3', 'p4']);
      s = playQuest(s, 0, ['p3', 'p4', 'p5', 'p6']);
      expect(s.quests[3]!.failsRequired).toBe(1);
      s = playQuest(s, 1, ['p1', 'p3', 'p4']);
      expect(s.quests[3]!.result).toBe('FAIL');
    });

    it('quest 5 with 7 players fails with a single Fail', () => {
      expect(startedGame(7, {}, BASE7).quests[4]!.failsRequired).toBe(1);
    });
  });
});

describe('victory conditions', () => {
  it('three failed quests end the game for Evil immediately', () => {
    let s = game5();
    s = playQuest(s, 1, ['p4', 'p1']);
    s = playQuest(s, 1, ['p4', 'p1', 'p2']);
    expect(s.phase).toBe('TEAM_PROPOSAL');
    s = playQuest(s, 1, ['p4', 'p1']);
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).toBe('EVIL');
    expect(s.winReason).toBe('THREE_QUESTS_FAILED');
  });

  function goodThree(): GameState {
    let s = game5();
    s = playQuest(s, 0, ['p1', 'p2']);
    s = playQuest(s, 0, ['p1', 'p2', 'p3']);
    s = playQuest(s, 0, ['p1', 'p2']);
    return s;
  }

  it('three successful quests move to the assassination phase', () => {
    const s = goodThree();
    expect(s.phase).toBe('ASSASSINATION');
    expect(s.winner).toBeNull();
  });

  it('assassinating Merlin wins for Evil', () => {
    const s = goodThree();
    const r = mustApply(s, { type: 'ASSASSINATE', commandId: cid(), stepId: s.stepId, targetId: playerWithRole(s, 'MERLIN') }, as(playerWithRole(s, 'ASSASSIN')));
    expect(r.phase).toBe('GAME_OVER');
    expect(r.winner).toBe('EVIL');
    expect(r.winReason).toBe('MERLIN_ASSASSINATED');
  });

  it('assassinating anyone else wins for Good', () => {
    const s = goodThree();
    const r = mustApply(s, { type: 'ASSASSINATE', commandId: cid(), stepId: s.stepId, targetId: 'p2' }, as('p4'));
    expect(r.winner).toBe('GOOD');
    expect(r.winReason).toBe('MERLIN_SURVIVED');
  });

  it('only the Assassin may assassinate, and not a known Evil player or themselves', () => {
    const s = goodThree();
    const r1 = applyCommand(s, { type: 'ASSASSINATE', commandId: cid(), stepId: s.stepId, targetId: 'p1' }, as('p5'), rng);
    expect(r1.ok ? 'ok' : r1.error.code).toBe('NOT_AUTHORIZED');
    const r2 = applyCommand(s, { type: 'ASSASSINATE', commandId: cid(), stepId: s.stepId, targetId: 'p5' }, as('p4'), rng);
    expect(r2.ok ? 'ok' : r2.error.code).toBe('INVALID_TARGET');
    const r3 = applyCommand(s, { type: 'ASSASSINATE', commandId: cid(), stepId: s.stepId, targetId: 'p4' }, as('p4'), rng);
    expect(r3.ok ? 'ok' : r3.error.code).toBe('INVALID_TARGET');
  });

  it('the Assassin may target Oberon (unknown to them); that is a miss', () => {
    const roles = ['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION', 'OBERON'];
    let s = toTeamProposal(startedGame(8, { optionalRoles: ['OBERON'] }, roles));
    s = playQuest(s, 0, ['p1', 'p2', 'p3']);
    s = playQuest(s, 0, ['p1', 'p2', 'p3', 'p4']);
    s = playQuest(s, 0, ['p1', 'p2', 'p3', 'p4']);
    expect(s.phase).toBe('ASSASSINATION');
    const r = mustApply(s, { type: 'ASSASSINATE', commandId: cid(), stepId: s.stepId, targetId: 'p8' }, as('p6'));
    expect(r.winner).toBe('GOOD');
  });
});

describe('robustness', () => {
  it('repeated commands with the same id are idempotent', () => {
    const s = propose(game5());
    const cmd = { type: 'CAST_VOTE' as const, commandId: 'same-id', stepId: s.stepId, approve: true };
    const a = applyCommand(s, cmd, as('p1'), rng);
    expect(a.ok && !a.duplicate).toBe(true);
    if (!a.ok) return;
    const b = applyCommand(a.state, cmd, as('p1'), rng);
    expect(b.ok && b.duplicate).toBe(true);
    if (!b.ok) return;
    expect(b.state).toBe(a.state);
    expect(b.state.version).toBe(a.state.version);
  });

  it('the same command id from two different players is not treated as a duplicate', () => {
    let s = propose(game5());
    s = mustApply(s, { type: 'CAST_VOTE', commandId: 'x', stepId: s.stepId, approve: true }, as('p1'));
    s = mustApply(s, { type: 'CAST_VOTE', commandId: 'x', stepId: s.stepId, approve: true }, as('p2'));
    expect(Object.keys(s.pendingVotes)).toEqual(['p1', 'p2']);
  });

  it('late commands from a previous step are rejected', () => {
    const s = game5();
    const oldStep = s.stepId;
    const s2 = propose(s);
    const r = applyCommand(s2, { type: 'PROPOSE_TEAM', commandId: cid(), stepId: oldStep, team: ['p1', 'p2'] }, as(leader(s)), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('WRONG_PHASE');
    const r2 = applyCommand(s2, { type: 'CAST_VOTE', commandId: cid(), stepId: oldStep, approve: true }, as('p1'), rng);
    expect(r2.ok ? 'ok' : r2.error.code).toBe('STALE_STEP');
  });

  it('out-of-phase commands are rejected', () => {
    const s = game5();
    const r = applyCommand(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: true }, as('p1'), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('WRONG_PHASE');
    const r2 = applyCommand(s, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: s.stepId, card: 'FAIL' }, as('p4'), rng);
    expect(r2.ok ? 'ok' : r2.error.code).toBe('WRONG_PHASE');
  });

  it('strangers are rejected', () => {
    const s = propose(game5());
    const r = applyCommand(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: true }, as('intruder'), rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('NOT_A_PLAYER');
  });

  it('nothing is accepted after GAME_OVER', () => {
    let s = game5();
    for (let i = 0; i < 5; i++) s = ackAll(voteAll(propose(s), 0));
    expect(s.phase).toBe('GAME_OVER');
    const r = applyCommand(s, { type: 'ADVANCE', commandId: cid(), stepId: s.stepId }, sys, rng);
    expect(r.ok ? 'ok' : r.error.code).toBe('GAME_OVER');
  });

  it('applyCommand never mutates its input', () => {
    const s = propose(game5());
    const snapshot = JSON.stringify(s);
    applyCommand(s, { type: 'CAST_VOTE', commandId: cid(), stepId: s.stepId, approve: true }, as('p1'), rng);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('is deterministic for a given seed', () => {
    const a = startedGame(8, {}, undefined, 42);
    const b = startedGame(8, {}, undefined, 42);
    expect(a.roles).toEqual(b.roles);
    expect(a.leaderIndex).toBe(b.leaderIndex);
  });
});
