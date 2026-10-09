import { describe, expect, it } from 'vitest';
import { seededRng } from '../../engine';
import { RoomManager } from '../../server/rooms';
import { guide } from '../guide';

function table(n = 5) {
  const rm = new RoomManager({ rng: seededRng(5) });
  const c = rm.createRoom({ name: 'Ana' });
  if (!c.ok) throw new Error();
  const code = c.value.room.code;
  const ids = [c.value.playerId];
  for (let i = 1; i < n; i++) {
    const j = rm.joinRoom(code, { name: `P${i}` });
    if (!j.ok) throw new Error();
    ids.push(j.value.playerId);
  }
  ids.forEach((id) => rm.setConnected(code, id, true));
  return { rm, code, ids };
}

describe('guided instructions', () => {
  it('tells the lobby how many players are missing', () => {
    const { rm, code, ids } = table(3);
    expect(guide(rm.viewFor(code, ids[1]!)!).detail).toContain('Waiting for 2 more players');
  });

  it('tells the leader exactly how many to select, and others who is choosing', () => {
    const { rm, code, ids } = table(5);
    ids.forEach((id) => rm.setReady(code, id, true));
    rm.startGame(code, ids[0]!);
    const g = () => rm.getRoom(code)!.game!;
    for (let k = 0; k < 2; k++) ids.forEach((id) => rm.command(code, id, { type: 'ACKNOWLEDGE', commandId: `ack-${k}-${id}`, stepId: g().stepId }));
    expect(g().phase).toBe('TEAM_PROPOSAL');
    const leader = g().players[g().leaderIndex]!;
    const other = ids.find((i) => i !== leader)!;
    expect(guide(rm.viewFor(code, leader)!).headline).toBe('You are the leader. Select 2 players for the quest.');
    expect(guide(rm.viewFor(code, other)!).headline).toContain('is choosing 2 players for quest 1');
    expect(guide(rm.viewFor(code, other)!).mustAct).toBe(false);
  });

  it('confirms a locked vote and counts the remaining voters', () => {
    const { rm, code, ids } = table(5);
    ids.forEach((id) => rm.setReady(code, id, true));
    rm.startGame(code, ids[0]!);
    const g = () => rm.getRoom(code)!.game!;
    for (let k = 0; k < 2; k++) ids.forEach((id) => rm.command(code, id, { type: 'ACKNOWLEDGE', commandId: `ack-${k}-${id}`, stepId: g().stepId }));
    const leader = g().players[g().leaderIndex]!;
    rm.command(code, leader, { type: 'PROPOSE_TEAM', commandId: 'prop-1', stepId: g().stepId, team: g().players.slice(0, 2) });
    rm.command(code, ids[0]!, { type: 'CAST_VOTE', commandId: 'vote-a', stepId: g().stepId, approve: true });
    expect(guide(rm.viewFor(code, ids[0]!)!).headline).toBe('Your vote is locked. Waiting for 4 players.');
  });
});
