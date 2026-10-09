import {
  applyCommand,
  createGame,
  getPrivatePlayerState,
  getPublicGameState,
  isAckPhase,
  MAX_PLAYERS,
  MIN_PLAYERS,
  optionalRoleIds,
  validateConfig,
  type Command,
  type ConfigIssue,
  type EngineEvent,
  type GameState,
  type PlayerId,
  type PrivatePlayerState,
  type PublicGameState,
  type Rng,
  type RoleId,
} from '../engine';
import { generateRoomCode, generateToken, hashToken, newId, tokensMatch } from './crypto';
import { sanitizeChat, sanitizeName } from './sanitize';

export const AVATARS = ['oak', 'raven', 'lantern', 'stag', 'rose', 'moon', 'tower', 'fox', 'key', 'anvil', 'owl', 'sail'] as const;
export type AvatarId = (typeof AVATARS)[number];

export interface Member {
  playerId: PlayerId;
  name: string;
  avatar: AvatarId;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  isSpectator: boolean;
  tokenHash: string;
  joinedAt: number;
}

export interface RoomSettings {
  optionalRoles: RoleId[];
  tutorial: boolean;
  timersEnabled: boolean;
  timerSeconds: number;
  allowSpectators: boolean;
  chatEnabled: boolean;
  revealRolesAtEnd: boolean;
  assassinationTargets: 'NOT_KNOWN_EVIL' | 'ANY_OTHER_PLAYER';
  /** Listed on the home screen so anyone can join without the code. */
  listed: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: PlayerId;
  text: string;
  at: number;
}

export interface Room {
  code: string;
  hostId: PlayerId;
  members: Member[];
  settings: RoomSettings;
  game: GameState | null;
  gameNumber: number;
  chat: ChatMessage[];
  /** Advisory discussion deadline for TEAM_PROPOSAL (epoch ms). */
  discussionDeadline: number | null;
  /** When the current reveal phase will auto-advance (epoch ms). */
  autoAdvanceAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  optionalRoles: [],
  tutorial: true,
  timersEnabled: false,
  timerSeconds: 180,
  allowSpectators: false,
  chatEnabled: false,
  revealRolesAtEnd: true,
  assassinationTargets: 'NOT_KNOWN_EVIL',
  listed: false,
};

/** How long each reveal phase waits before the server moves on by itself. */
export const AUTO_ADVANCE_MS: Partial<Record<GameState['phase'], number>> = {
  VOTE_REVEAL: 20_000,
  QUEST_REVEAL: 25_000,
  ROUND_RESULT: 15_000,
};
export const HOST_HANDOVER_MS = 60_000;
export const ROOM_IDLE_TTL_MS = 6 * 60 * 60_000;
const CHAT_HISTORY = 100;

export type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

// ---------------------------------------------------------------------------
// Client-facing views. These are the ONLY shapes sent over the wire.
// ---------------------------------------------------------------------------

export interface PublicMember {
  playerId: PlayerId;
  name: string;
  avatar: AvatarId;
  ready: boolean;
  connected: boolean;
  isSpectator: boolean;
  isHost: boolean;
}

export interface RoomView {
  code: string;
  hostId: PlayerId;
  members: PublicMember[];
  settings: RoomSettings;
  gameNumber: number;
  chat: ChatMessage[];
  discussionDeadline: number | null;
  autoAdvanceAt: number | null;
  configIssues: ConfigIssue[];
  availableOptionalRoles: RoleId[];
  game: PublicGameState | null;
  you: { playerId: PlayerId; isHost: boolean; isSpectator: boolean };
  /** Present only for seated players with an assigned role. */
  me: PrivatePlayerState | null;
  serverTime: number;
}

/** A public lobby as shown on the home screen. Contains nothing beyond what joining would reveal. */
export interface ListedRoom {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
}

export interface ChangeNotice {
  code: string;
  events: EngineEvent[];
}

export interface RoomManagerOptions {
  rng: Rng;
  now?: () => number;
  onChange?: (notice: ChangeNotice) => void;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private readonly rng: Rng;
  private readonly now: () => number;
  private readonly onChange: (n: ChangeNotice) => void;

  constructor(opts: RoomManagerOptions) {
    this.rng = opts.rng;
    this.now = opts.now ?? Date.now;
    this.onChange = opts.onChange ?? (() => {});
  }

  // ----- lifecycle -----------------------------------------------------------

  restore(rooms: Room[]): void {
    for (const r of rooms) {
      // Snapshots saved before a setting existed get its default.
      r.settings = { ...DEFAULT_SETTINGS, ...r.settings };
      // After a restart nobody is connected yet.
      for (const m of r.members) {
        m.connected = false;
        m.disconnectedAt ??= this.now();
      }
      this.rooms.set(r.code, r);
    }
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  allRooms(): Room[] {
    return [...this.rooms.values()];
  }

  /** Rooms the host chose to list that a newcomer could take a seat in right now. */
  listedRooms(limit = 20): ListedRoom[] {
    return this.allRooms()
      .filter((r) => r.settings.listed && !r.game && this.seated(r).length < MAX_PLAYERS && !!this.member(r, r.hostId)?.connected)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((r) => ({ code: r.code, hostName: this.member(r, r.hostId)!.name, players: this.seated(r).length, maxPlayers: MAX_PLAYERS }));
  }

  private touch(room: Room, events: EngineEvent[] = []): void {
    room.updatedAt = this.now();
    this.onChange({ code: room.code, events });
  }

  private seated(room: Room): Member[] {
    return room.members.filter((m) => !m.isSpectator);
  }

  private member(room: Room, playerId: PlayerId): Member | undefined {
    return room.members.find((m) => m.playerId === playerId);
  }

  // ----- joining -------------------------------------------------------------

  createRoom(input: { name: string; avatar?: string }): Result<{ room: Room; playerId: PlayerId; token: string }> {
    const name = sanitizeName(input.name);
    if (!name.ok) return fail('INVALID_NAME', name.message);
    let code = generateRoomCode();
    for (let i = 0; this.rooms.has(code); i++) {
      if (i > 20) return fail('UNAVAILABLE', 'Could not create a room right now. Try again.');
      code = generateRoomCode();
    }
    const token = generateToken();
    const host = this.newMember(name.value, input.avatar, token, false);
    const t = this.now();
    const room: Room = {
      code,
      hostId: host.playerId,
      members: [host],
      settings: { ...DEFAULT_SETTINGS },
      game: null,
      gameNumber: 0,
      chat: [],
      discussionDeadline: null,
      autoAdvanceAt: null,
      createdAt: t,
      updatedAt: t,
    };
    this.rooms.set(code, room);
    this.touch(room);
    return ok({ room, playerId: host.playerId, token });
  }

  joinRoom(code: string, input: { name: string; avatar?: string; asSpectator?: boolean }): Result<{ room: Room; playerId: PlayerId; token: string }> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'No room uses that code. Check it with the host.');
    const name = sanitizeName(input.name);
    if (!name.ok) return fail('INVALID_NAME', name.message);
    if (room.members.some((m) => m.name.toLocaleLowerCase() === name.value.toLocaleLowerCase())) {
      return fail('NAME_TAKEN', 'Someone in this room already uses that name. Pick another.');
    }

    let asSpectator = !!input.asSpectator;
    const gameRunning = !!room.game && room.game.phase !== 'GAME_OVER';
    if (!asSpectator && (gameRunning || this.seated(room).length >= MAX_PLAYERS)) {
      if (!room.settings.allowSpectators) {
        return fail(
          gameRunning ? 'GAME_IN_PROGRESS' : 'ROOM_FULL',
          gameRunning ? 'This game has already started. Ask the host to let you in for the rematch.' : 'This room already has 10 players.',
        );
      }
      asSpectator = true;
    }
    if (asSpectator && !room.settings.allowSpectators) {
      return fail('NO_SPECTATORS', 'The host has not allowed spectators in this room.');
    }

    const token = generateToken();
    const m = this.newMember(name.value, input.avatar, token, asSpectator);
    room.members.push(m);
    this.touch(room);
    return ok({ room, playerId: m.playerId, token });
  }

  /** Securely re-attach a client to its original seat. */
  resume(code: string, token: string): Result<{ room: Room; playerId: PlayerId }> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'This room no longer exists.');
    const m = room.members.find((x) => tokensMatch(token, x.tokenHash));
    if (!m) return fail('SESSION_INVALID', 'Your seat could not be restored. Join again with the room code.');
    return ok({ room, playerId: m.playerId });
  }

  setConnected(code: string, playerId: PlayerId, connected: boolean): void {
    const room = this.rooms.get(code);
    const m = room && this.member(room, playerId);
    if (!room || !m || m.connected === connected) return;
    m.connected = connected;
    m.disconnectedAt = connected ? null : this.now();
    // A disconnect may unblock a reveal phase that was waiting on that player.
    const events = this.autoAdvanceIfReady(room);
    this.touch(room, events);
  }

  private newMember(name: string, avatar: string | undefined, token: string, isSpectator: boolean): Member {
    return {
      playerId: newId(),
      name,
      avatar: (AVATARS as readonly string[]).includes(avatar ?? '') ? (avatar as AvatarId) : AVATARS[this.rng.int(AVATARS.length)]!,
      ready: false,
      connected: false,
      disconnectedAt: null,
      isSpectator,
      tokenHash: hashToken(token),
      joinedAt: this.now(),
    };
  }

  // ----- lobby ---------------------------------------------------------------

  private requireLobby(room: Room): Result<null> {
    if (room.game && room.game.phase !== 'GAME_OVER') return fail('GAME_IN_PROGRESS', 'You can only change this between games.');
    return ok(null);
  }

  private requireHost(room: Room, actorId: PlayerId): Result<null> {
    if (room.hostId !== actorId) return fail('NOT_HOST', 'Only the host can do that.');
    return ok(null);
  }

  setReady(code: string, playerId: PlayerId, ready: boolean): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    const lobby = this.requireLobby(room);
    if (!lobby.ok) return lobby;
    const m = this.member(room, playerId);
    if (!m || m.isSpectator) return fail('NOT_A_PLAYER', 'Spectators do not need to get ready.');
    m.ready = ready;
    this.touch(room);
    return ok(null);
  }

  updateSettings(code: string, actorId: PlayerId, patch: Partial<RoomSettings>): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    const checks = [this.requireHost(room, actorId), this.requireLobby(room)];
    for (const c of checks) if (!c.ok) return c;

    const next: RoomSettings = { ...room.settings, ...patch };
    next.optionalRoles = [...new Set(next.optionalRoles)].filter((r) => optionalRoleIds().includes(r));
    next.timerSeconds = Math.min(600, Math.max(30, Math.round(next.timerSeconds)));
    const rolesChanged = JSON.stringify(next.optionalRoles) !== JSON.stringify(room.settings.optionalRoles);
    room.settings = next;
    if (!next.allowSpectators) this.seatOrDropSpectators(room);
    if (rolesChanged) for (const m of room.members) m.ready = false; // everyone re-confirms the new setup
    this.touch(room);
    return ok(null);
  }

  /** Gives spectators a seat while seats remain; anyone left over is removed. */
  private seatOrDropSpectators(room: Room): void {
    for (const m of room.members) {
      if (m.isSpectator && this.seated(room).length < MAX_PLAYERS) m.isSpectator = false;
    }
    room.members = room.members.filter((m) => !m.isSpectator);
  }

  /** Lets a spectator take a free seat between games. */
  takeSeat(code: string, playerId: PlayerId): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    const lobby = this.requireLobby(room);
    if (!lobby.ok) return lobby;
    const m = this.member(room, playerId);
    if (!m) return fail('NOT_A_PLAYER', 'You are not in this room.');
    if (this.seated(room).length >= MAX_PLAYERS) return fail('ROOM_FULL', 'All 10 seats are taken.');
    m.isSpectator = false;
    m.ready = false;
    this.touch(room);
    return ok(null);
  }

  removePlayer(code: string, actorId: PlayerId, targetId: PlayerId): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    for (const c of [this.requireHost(room, actorId), this.requireLobby(room)]) if (!c.ok) return c;
    if (targetId === actorId) return fail('INVALID_TARGET', 'Transfer host first if you want to leave.');
    const before = room.members.length;
    room.members = room.members.filter((m) => m.playerId !== targetId); // also revokes their token
    if (room.members.length === before) return fail('INVALID_TARGET', 'That player is no longer in the room.');
    this.touch(room);
    return ok(null);
  }

  leave(code: string, playerId: PlayerId): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    const lobby = this.requireLobby(room);
    if (!lobby.ok) return fail('GAME_IN_PROGRESS', 'You cannot leave your seat mid-game. You can close the tab and rejoin later.');
    room.members = room.members.filter((m) => m.playerId !== playerId);
    if (room.members.length === 0) {
      this.rooms.delete(room.code);
      return ok(null);
    }
    if (room.hostId === playerId) room.hostId = (room.members.find((m) => m.connected) ?? room.members[0]!).playerId;
    this.touch(room);
    return ok(null);
  }

  transferHost(code: string, actorId: PlayerId, targetId: PlayerId): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    const host = this.requireHost(room, actorId);
    if (!host.ok) return host;
    if (!this.member(room, targetId)) return fail('INVALID_TARGET', 'That player is not in the room.');
    room.hostId = targetId;
    this.touch(room);
    return ok(null);
  }

  startGame(code: string, actorId: PlayerId): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    for (const c of [this.requireHost(room, actorId), this.requireLobby(room)]) if (!c.ok) return c;
    const players = this.seated(room);
    const blocked = this.startBlockers(room);
    if (blocked) return fail('NOT_READY', blocked);

    // Seat order is randomised once per game so leadership order is fair.
    const seatOrder = players.map((p) => p.playerId);
    for (let i = seatOrder.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [seatOrder[i], seatOrder[j]] = [seatOrder[j]!, seatOrder[i]!];
    }
    room.gameNumber += 1;
    const game = createGame(`${room.code}-${room.gameNumber}`, seatOrder, {
      optionalRoles: room.settings.optionalRoles,
      revealRolesAtEnd: room.settings.revealRolesAtEnd,
      assassinationTargets: room.settings.assassinationTargets,
    });
    const r = applyCommand(game, { type: 'START_GAME', commandId: newId() }, { kind: 'system' }, this.rng);
    if (!r.ok) return fail('INVALID_CONFIG', r.error.message);
    room.game = r.state;
    room.chat = [];
    this.updateTimers(room);
    this.touch(room, r.events);
    return ok(null);
  }

  /** Returns a friendly reason the game cannot start, or null. */
  startBlockers(room: Room): string | null {
    const players = this.seated(room);
    if (players.length < MIN_PLAYERS) return `Waiting for ${MIN_PLAYERS - players.length} more player${MIN_PLAYERS - players.length > 1 ? 's' : ''}.`;
    if (players.length > MAX_PLAYERS) return `Too many players. Move ${players.length - MAX_PLAYERS} to spectators.`;
    const issue = this.configIssues(room).find((i) => i.severity === 'error');
    if (issue) return issue.message;
    const notReady = players.filter((p) => !p.ready);
    if (notReady.length) return `Waiting for ${notReady.length} player${notReady.length > 1 ? 's' : ''} to get ready.`;
    const offline = players.filter((p) => !p.connected);
    if (offline.length) return `${offline.map((p) => p.name).join(', ')} ${offline.length > 1 ? 'are' : 'is'} offline. Wait or remove them.`;
    return null;
  }

  configIssues(room: Room): ConfigIssue[] {
    return validateConfig(
      { optionalRoles: room.settings.optionalRoles, revealRolesAtEnd: true, assassinationTargets: room.settings.assassinationTargets },
      this.seated(room).length,
    );
  }

  rematch(code: string, actorId: PlayerId): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    const host = this.requireHost(room, actorId);
    if (!host.ok) return host;
    if (!room.game || room.game.phase !== 'GAME_OVER') return fail('GAME_IN_PROGRESS', 'Finish the current game first.');
    room.game = null;
    room.discussionDeadline = null;
    room.autoAdvanceAt = null;
    for (const m of room.members) m.ready = false;
    this.touch(room);
    return ok(null);
  }

  // ----- in-game commands ----------------------------------------------------

  command(code: string, playerId: PlayerId, command: Exclude<Command, { type: 'START_GAME' } | { type: 'ADVANCE' }>): Result<{ duplicate: boolean }> {
    const room = this.rooms.get(code);
    if (!room?.game) return fail('NO_GAME', 'There is no game running.');
    const r = applyCommand(room.game, command, { kind: 'player', playerId }, this.rng);
    if (!r.ok) return fail(r.error.code, r.error.message);
    if (r.duplicate) return ok({ duplicate: true });
    room.game = r.state;
    const events = [...r.events, ...this.autoAdvanceIfReady(room)];
    this.updateTimers(room);
    this.touch(room, events);
    return ok({ duplicate: false });
  }

  /**
   * Reveal phases advance once every *connected* player has continued, so a
   * briefly disconnected player never stalls the table.
   */
  private autoAdvanceIfReady(room: Room): EngineEvent[] {
    const events: EngineEvent[] = [];
    for (let guard = 0; guard < 10 && room.game && isAckPhase(room.game.phase); guard++) {
      const game: GameState = room.game;
      const connected = this.seated(room).filter((m) => m.connected).map((m) => m.playerId);
      const waiting = connected.filter((p) => !game.acknowledged.includes(p));
      if (connected.length === 0 || waiting.length > 0) break;
      if (!this.systemAdvance(room, events)) break;
    }
    return events;
  }

  private systemAdvance(room: Room, events: EngineEvent[]): boolean {
    if (!room.game) return false;
    const r = applyCommand(room.game, { type: 'ADVANCE', commandId: newId(), stepId: room.game.stepId }, { kind: 'system' }, this.rng);
    if (!r.ok) return false;
    room.game = r.state;
    events.push(...r.events);
    return true;
  }

  private updateTimers(room: Room): void {
    const phase = room.game?.phase;
    const t = this.now();
    const auto = phase ? AUTO_ADVANCE_MS[phase] : undefined;
    room.autoAdvanceAt = auto ? t + auto : null;
    if (phase === 'TEAM_PROPOSAL') {
      if (room.settings.timersEnabled && room.discussionDeadline === null) room.discussionDeadline = t + room.settings.timerSeconds * 1000;
    } else {
      room.discussionDeadline = null;
    }
  }

  /** Periodic housekeeping: auto-advance reveal phases, hand over host, expire rooms. */
  tick(): void {
    const t = this.now();
    for (const room of this.rooms.values()) {
      if (t - room.updatedAt > ROOM_IDLE_TTL_MS && room.members.every((m) => !m.connected)) {
        this.rooms.delete(room.code);
        continue;
      }
      if (room.autoAdvanceAt !== null && t >= room.autoAdvanceAt) {
        const events: EngineEvent[] = [];
        this.systemAdvance(room, events);
        this.updateTimers(room);
        this.touch(room, events);
      }
      const host = this.member(room, room.hostId);
      if (host && !host.connected && host.disconnectedAt && t - host.disconnectedAt > HOST_HANDOVER_MS) {
        const next = room.members.find((m) => m.connected && !m.isSpectator) ?? room.members.find((m) => m.connected);
        if (next) {
          room.hostId = next.playerId;
          this.touch(room);
        }
      }
    }
  }

  // ----- chat -----------------------------------------------------------------

  chat(code: string, playerId: PlayerId, text: string): Result<null> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found.');
    if (!room.settings.chatEnabled) return fail('CHAT_DISABLED', 'Text chat is turned off in this room.');
    const m = this.member(room, playerId);
    if (!m || m.isSpectator) return fail('NOT_A_PLAYER', 'Only players can post in the room chat.');
    const clean = sanitizeChat(text);
    if (!clean.ok) return fail('INVALID_MESSAGE', clean.message);
    room.chat.push({ id: newId(), playerId, text: clean.value, at: this.now() });
    if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY);
    this.touch(room);
    return ok(null);
  }

  // ----- projection ------------------------------------------------------------

  /**
   * Builds the view for exactly one viewer. This is the single choke point for
   * outbound data: private state is computed per viewer and never shared.
   */
  viewFor(code: string, viewerId: PlayerId): RoomView | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const viewer = this.member(room, viewerId);
    if (!viewer) return null;
    const seatedInGame = !!room.game && room.game.players.includes(viewerId);
    return {
      code: room.code,
      hostId: room.hostId,
      members: room.members.map((m) => ({
        playerId: m.playerId,
        name: m.name,
        avatar: m.avatar,
        ready: m.ready,
        connected: m.connected,
        isSpectator: m.isSpectator,
        isHost: m.playerId === room.hostId,
      })),
      settings: { ...room.settings, optionalRoles: room.settings.optionalRoles.slice() },
      gameNumber: room.gameNumber,
      chat: room.settings.chatEnabled ? room.chat.slice(-CHAT_HISTORY) : [],
      discussionDeadline: room.discussionDeadline,
      autoAdvanceAt: room.autoAdvanceAt,
      configIssues: this.configIssues(room),
      availableOptionalRoles: optionalRoleIds(),
      game: room.game ? getPublicGameState(room.game) : null,
      you: { playerId: viewerId, isHost: room.hostId === viewerId, isSpectator: viewer.isSpectator },
      me: room.game && seatedInGame ? getPrivatePlayerState(room.game, viewerId) : null,
      serverTime: this.now(),
    };
  }
}
