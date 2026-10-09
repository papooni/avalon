import { describe, expect, it } from 'vitest';
import { seededRng } from '../../engine';
import { redact } from '../logger';
import { RoomManager, type RoomView } from '../rooms';
import { sanitizeChat, sanitizeName } from '../sanitize';

function setup(n = 5) {
  let t = 1_000_000;
  const rm = new RoomManager({ rng: seededRng(11), now: () => t });
  const created = rm.createRoom({ name: 'Host' });
  if (!created.ok) throw new Error(created.message);
  const code = created.value.room.code;
  const players = [{ id: created.value.playerId, token: created.value.token }];
  for (let i = 1; i < n; i++) {
    const j = rm.joinRoom(code, { name: `P${i}` });
    if (!j.ok) throw new Error(j.message);
    players.push({ id: j.value.playerId, token: j.value.token });
  }
  for (const p of players) rm.setConnected(code, p.id, true);
  return { rm, code, players, hostId: players[0]!.id, advance: (ms: number) => (t += ms) };
}

function startedRoom(n = 5) {
  const ctx = setup(n);
  for (const p of ctx.players) expect(ctx.rm.setReady(ctx.code, p.id, true).ok).toBe(true);
  const r = ctx.rm.startGame(ctx.code, ctx.hostId);
  if (!r.ok) throw new Error(r.message);
  return ctx;
}

const view = (rm: RoomManager, code: string, id: string) => rm.viewFor(code, id) as RoomView;

describe('rooms and lobby', () => {
  it('creates a room with a 6-character readable code and joins players', () => {
    const { code, rm, players } = setup(5);
    expect(/^[A-HJKMNP-Z2-9]{6}$/.test(code)).toBe(true);
    expect(rm.getRoom(code)!.members.length).toBe(players.length);
  });

  it('rejects duplicate names and unknown rooms with friendly messages', () => {
    const { rm, code } = setup(5);
    const dup = rm.joinRoom(code, { name: 'host' });
    expect(dup.ok ? 'ok' : dup.code).toBe('NAME_TAKEN');
    const missing = rm.joinRoom('ZZZZZZ', { name: 'x' });
    expect(missing.ok ? 'ok' : missing.code).toBe('ROOM_NOT_FOUND');
  });

  it('lists only opted-in, joinable lobbies with a connected host', () => {
    const { rm, code, hostId, players } = setup(3);
    expect(rm.listedRooms()).toEqual([]); // private by default
    expect(rm.updateSettings(code, players[1]!.id, { listed: true }).ok).toBe(false); // host only
    expect(rm.updateSettings(code, hostId, { listed: true }).ok).toBe(true);
    expect(rm.listedRooms()).toEqual([{ code, hostName: 'Host', players: 3, maxPlayers: 10 }]);
    // Nothing private leaks into the listing.
    expect(JSON.stringify(rm.listedRooms())).not.toMatch(/token|playerId|Hash/i);

    rm.setConnected(code, hostId, false);
    expect(rm.listedRooms()).toEqual([]);
    rm.setConnected(code, hostId, true);

    for (let i = 3; i < 10; i++) expect(rm.joinRoom(code, { name: `X${i}` }).ok).toBe(true);
    expect(rm.listedRooms()).toEqual([]); // full
  });

  it('hides a listed room once its game starts', () => {
    const { rm, code, hostId, players } = setup(5);
    rm.updateSettings(code, hostId, { listed: true });
    for (const p of players) rm.setReady(code, p.id, true);
    expect(rm.startGame(code, hostId).ok).toBe(true);
    expect(rm.listedRooms()).toEqual([]);
  });

  it('only the host may configure, remove players, transfer and start', () => {
    const { rm, code, players, hostId } = setup(5);
    const other = players[1]!.id;
    const a = rm.updateSettings(code, other, { optionalRoles: ['PERCIVAL'] });
    expect(a.ok ? 'ok' : a.code).toBe('NOT_HOST');
    const b = rm.startGame(code, other);
    expect(b.ok ? 'ok' : b.code).toBe('NOT_HOST');
    const c = rm.removePlayer(code, other, hostId);
    expect(c.ok ? 'ok' : c.code).toBe('NOT_HOST');
    expect(rm.transferHost(code, hostId, other).ok).toBe(true);
    expect(rm.getRoom(code)!.hostId).toBe(other);
  });

  it('will not start until everyone is ready and explains why', () => {
    const { rm, code, hostId } = setup(5);
    const r = rm.startGame(code, hostId);
    expect(r.ok ? 'ok' : r.message).toBe('Waiting for 5 players to get ready.');
  });

  it('will not start with fewer than 5 players', () => {
    const { rm, code, players, hostId } = setup(4);
    for (const p of players) rm.setReady(code, p.id, true);
    const r = rm.startGame(code, hostId);
    expect(r.ok ? 'ok' : r.message).toBe('Waiting for 1 more player.');
  });

  it('changing roles un-readies everyone', () => {
    const { rm, code, players, hostId } = setup(6);
    for (const p of players) rm.setReady(code, p.id, true);
    rm.updateSettings(code, hostId, { optionalRoles: ['PERCIVAL', 'MORGANA'] });
    expect(rm.getRoom(code)!.members.every((m) => !m.ready)).toBe(true);
  });

  it('host can remove a disconnected player before the game, revoking their seat', () => {
    const { rm, code, players, hostId } = setup(6);
    const gone = players[5]!;
    rm.setConnected(code, gone.id, false);
    expect(rm.removePlayer(code, hostId, gone.id).ok).toBe(true);
    const r = rm.resume(code, gone.token);
    expect(r.ok ? 'ok' : r.code).toBe('SESSION_INVALID');
  });

  it('blocks joining a running game unless spectators are allowed', () => {
    const { rm, code } = startedRoom(5);
    const r = rm.joinRoom(code, { name: 'Late' });
    expect(r.ok ? 'ok' : r.code).toBe('GAME_IN_PROGRESS');
  });

  it('hands host to a connected player after the host is gone for a while', () => {
    const { rm, code, hostId, advance } = setup(5);
    rm.setConnected(code, hostId, false);
    advance(61_000);
    rm.tick();
    expect(rm.getRoom(code)!.hostId).not.toBe(hostId);
  });
});

describe('reconnection', () => {
  it('restores the original seat and the same private state', () => {
    const { rm, code, players } = startedRoom(5);
    const p = players[2]!;
    const before = view(rm, code, p.id).me;
    rm.setConnected(code, p.id, false);
    const r = rm.resume(code, p.token);
    expect(r.ok && r.value.playerId).toBe(p.id);
    rm.setConnected(code, p.id, true);
    expect(view(rm, code, p.id).me).toEqual(before);
  });

  it('rejects forged or foreign tokens', () => {
    const a = startedRoom(5);
    const b = setup(5);
    expect(a.rm.resume(a.code, 'forged-token').ok).toBe(false);
    // A valid token for a different room manager/room cannot open this room.
    expect(a.rm.resume(a.code, b.players[0]!.token).ok).toBe(false);
  });

  it('a disconnected player does not block the reveal phases', () => {
    const { rm, code, players } = startedRoom(5);
    rm.setConnected(code, players[4]!.id, false);
    const game = () => rm.getRoom(code)!.game!;
    for (const p of players.slice(0, 4)) rm.command(code, p.id, { type: 'ACKNOWLEDGE', commandId: `a-${p.id}`, stepId: game().stepId });
    expect(game().phase).toBe('KNOWLEDGE_REVEAL');
  });

  it('a disconnect that leaves only acknowledged players advances immediately', () => {
    const { rm, code, players } = startedRoom(5);
    const game = () => rm.getRoom(code)!.game!;
    for (const p of players.slice(0, 4)) rm.command(code, p.id, { type: 'ACKNOWLEDGE', commandId: `a-${p.id}`, stepId: game().stepId });
    expect(game().phase).toBe('ROLE_REVEAL');
    rm.setConnected(code, players[4]!.id, false);
    expect(game().phase).toBe('KNOWLEDGE_REVEAL');
  });
});

describe('hidden information in views', () => {
  it('each view contains only the viewer’s own role, and spectators get none', () => {
    const { rm, code, players } = startedRoom(7);
    const room = rm.getRoom(code)!;
    for (const p of players) {
      const v = view(rm, code, p.id);
      const json = JSON.stringify(v);
      expect(v.me!.roleId).toBe(room.game!.roles[p.id]!);
      const others = players.filter((o) => o.id !== p.id);
      // No key in the view maps another player to a role.
      for (const o of others) expect(json.includes(`"${o.id}":"`)).toBe(false);
      expect(json).not.toContain('tokenHash');
      expect(json).not.toContain('pendingVotes');
    }
  });

  it('a player cannot obtain another player’s view without their token', () => {
    const { rm, code, players } = startedRoom(5);
    // The only way to get a viewer id bound to a socket is resume(token).
    const r = rm.resume(code, 'guess');
    expect(r.ok).toBe(false);
    expect(players.length).toBe(5);
  });

  it('the logger redacts secret fields and role names', () => {
    const out = JSON.stringify(redact({ roles: { a: 'MERLIN' }, msg: 'p1 is MERLIN', approve: true, nested: { card: 'FAIL' } }));
    expect(out).not.toContain('MERLIN');
    expect(out).not.toContain('FAIL');
    expect(out).not.toContain('true');
  });
});

describe('commands through the room', () => {
  it('idempotent command ids return duplicate without changing state', () => {
    const { rm, code, players } = startedRoom(5);
    const stepId = rm.getRoom(code)!.game!.stepId;
    const first = rm.command(code, players[0]!.id, { type: 'ACKNOWLEDGE', commandId: 'k1', stepId });
    const v = rm.getRoom(code)!.game!.version;
    const second = rm.command(code, players[0]!.id, { type: 'ACKNOWLEDGE', commandId: 'k1', stepId });
    expect(first.ok && !first.value.duplicate).toBe(true);
    expect(second.ok && second.value.duplicate).toBe(true);
    expect(rm.getRoom(code)!.game!.version).toBe(v);
  });

  it('rematch returns to the lobby with the same players', () => {
    const { rm, code, players, hostId } = startedRoom(5);
    const room = rm.getRoom(code)!;
    room.game = { ...room.game!, phase: 'GAME_OVER', winner: 'GOOD', winReason: 'MERLIN_SURVIVED' };
    expect(rm.rematch(code, hostId).ok).toBe(true);
    expect(room.game).toBeNull();
    expect(room.members.length).toBe(players.length);
  });
});

describe('sanitisation', () => {
  it('strips control, zero-width and angle characters from names', () => {
    const r = sanitizeName('  <b>Ar\u200Bthur</b>\u0007  ');
    expect(r.ok && r.value).toBe('bArthur/b');
  });
  it('rejects empty and overlong input', () => {
    expect(sanitizeName('   ').ok).toBe(false);
    expect(sanitizeName('x'.repeat(21)).ok).toBe(false);
    expect(sanitizeChat('y'.repeat(281)).ok).toBe(false);
  });
});
