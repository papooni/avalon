import type { Server, Socket } from 'socket.io';
import type { z, ZodTypeAny } from 'zod';
import { log } from './logger';
import { CreateRoom, ChatSend, EVENTS, Empty, GameCommand, JoinRoom, ResumeRoom, SetReady, TargetPlayer, UpdateSettings, type Ack } from './protocol';
import { RateLimiter } from './rateLimit';
import type { RoomManager } from './rooms';

interface SocketData {
  code?: string;
  playerId?: string;
  ip: string;
}
type AppSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

const roomChannel = (code: string) => `room:${code}`;
const seatChannel = (code: string, playerId: string) => `seat:${code}:${playerId}`;

/**
 * Wires Socket.IO to the RoomManager.
 *
 * Outbound rule: views are emitted to per-seat channels (`seat:<code>:<id>`),
 * one tailored view per player. Nothing private is ever emitted to the room
 * channel; the room channel is used only to discover who is in the room.
 */
export function attachSocketServer(io: Server, rooms: RoomManager) {
  const eventLimiter = new RateLimiter(30, 10); // per socket: bursts of 30, 10/s sustained
  const joinLimiter = new RateLimiter(10, 0.2); // per IP: 10 room joins/creates, then 1 per 5s
  const chatLimiter = new RateLimiter(5, 0.5);

  const pushViews = async (code: string) => {
    const room = rooms.getRoom(code);
    if (!room) return;
    for (const m of room.members) {
      const view = rooms.viewFor(code, m.playerId);
      if (view) io.to(seatChannel(code, m.playerId)).emit(EVENTS.view, view);
    }
  };

  io.on('connection', (raw) => {
    const socket = raw as unknown as AppSocket;
    socket.data.ip = (socket.handshake.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || socket.handshake.address;

    const bind = async (code: string, playerId: string) => {
      if (socket.data.code && socket.data.playerId) rooms.setConnected(socket.data.code, socket.data.playerId, false);
      socket.data.code = code;
      socket.data.playerId = playerId;
      await socket.join([roomChannel(code), seatChannel(code, playerId)]);
      rooms.setConnected(code, playerId, true);
    };

    /** Registers a handler with validation, rate limiting and safe error handling. */
    function on<S extends ZodTypeAny>(event: string, schema: S, handler: (input: z.output<S>, ack: (a: Ack) => void) => void | Promise<void>, needsSeat = true) {
      socket.on(event, async (payload: unknown, ackFn?: unknown) => {
        const ack = typeof ackFn === 'function' ? (ackFn as (a: Ack) => void) : () => {};
        if (!eventLimiter.take(socket.id)) return ack({ ok: false, code: 'RATE_LIMITED', message: 'Slow down a little and try again.' });
        if (needsSeat && (!socket.data.code || !socket.data.playerId)) {
          return ack({ ok: false, code: 'NOT_IN_ROOM', message: 'Join a room first.' });
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'That request was not valid.' });
        try {
          await handler(parsed.data, ack);
        } catch (e) {
          log.error('Handler failed', { event, error: e });
          ack({ ok: false, code: 'SERVER_ERROR', message: 'Something went wrong on the server. Try again.' });
        }
      });
    }

    const seat = () => ({ code: socket.data.code!, playerId: socket.data.playerId! });
    const reply = (ack: (a: Ack) => void, r: { ok: true } | { ok: false; code: string; message: string }) =>
      ack(r.ok ? { ok: true } : { ok: false, code: r.code, message: r.message });

    on(EVENTS.create, CreateRoom, async (input, ack) => {
      if (!joinLimiter.take(socket.data.ip)) return ack({ ok: false, code: 'RATE_LIMITED', message: 'Too many rooms created. Wait a minute.' });
      const r = rooms.createRoom(input);
      if (!r.ok) return reply(ack, r);
      await bind(r.value.room.code, r.value.playerId);
      log.info('room created', { room: r.value.room.code });
      ack({ ok: true, data: { code: r.value.room.code, playerId: r.value.playerId, token: r.value.token } });
    }, false);

    on(EVENTS.join, JoinRoom, async (input, ack) => {
      if (!joinLimiter.take(socket.data.ip)) return ack({ ok: false, code: 'RATE_LIMITED', message: 'Too many attempts. Wait a minute.' });
      const r = rooms.joinRoom(input.code, input);
      if (!r.ok) return reply(ack, r);
      await bind(input.code, r.value.playerId);
      ack({ ok: true, data: { code: input.code, playerId: r.value.playerId, token: r.value.token } });
    }, false);

    on(EVENTS.resume, ResumeRoom, async (input, ack) => {
      if (!joinLimiter.take(`resume:${socket.data.ip}`)) return ack({ ok: false, code: 'RATE_LIMITED', message: 'Too many attempts. Wait a minute.' });
      const r = rooms.resume(input.code, input.token);
      if (!r.ok) return reply(ack, r);
      await bind(input.code, r.value.playerId);
      ack({ ok: true, data: { code: input.code, playerId: r.value.playerId } });
    }, false);

    on(EVENTS.list, Empty, (_i, ack) => ack({ ok: true, data: rooms.listedRooms() }), false);

    on(EVENTS.ready, SetReady, (i, ack) => reply(ack, rooms.setReady(seat().code, seat().playerId, i.ready)));
    on(EVENTS.settings, UpdateSettings, (i, ack) => reply(ack, rooms.updateSettings(seat().code, seat().playerId, i)));
    on(EVENTS.remove, TargetPlayer, async (i, ack) => {
      const { code } = seat();
      const r = rooms.removePlayer(code, seat().playerId, i.playerId);
      if (r.ok) {
        io.to(seatChannel(code, i.playerId)).emit(EVENTS.kicked, { message: 'The host removed you from the room.' });
        io.in(seatChannel(code, i.playerId)).socketsLeave([roomChannel(code), seatChannel(code, i.playerId)]);
      }
      reply(ack, r);
    });
    on(EVENTS.transfer, TargetPlayer, (i, ack) => reply(ack, rooms.transferHost(seat().code, seat().playerId, i.playerId)));
    on(EVENTS.start, Empty, (_i, ack) => reply(ack, rooms.startGame(seat().code, seat().playerId)));
    on(EVENTS.takeSeat, Empty, (_i, ack) => reply(ack, rooms.takeSeat(seat().code, seat().playerId)));
    on(EVENTS.rematch, Empty, (_i, ack) => reply(ack, rooms.rematch(seat().code, seat().playerId)));
    on(EVENTS.leave, Empty, async (_i, ack) => {
      const { code, playerId } = seat();
      const r = rooms.leave(code, playerId);
      if (r.ok) {
        await socket.leave(roomChannel(code));
        await socket.leave(seatChannel(code, playerId));
        socket.data.code = undefined;
        socket.data.playerId = undefined;
      }
      reply(ack, r);
    });
    on(EVENTS.command, GameCommand, (cmd, ack) => {
      const r = rooms.command(seat().code, seat().playerId, cmd);
      if (!r.ok) {
        // Command contents are never logged; only the type and outcome.
        log.debug('command rejected', { type: cmd.type, reason: r.code });
        return reply(ack, r);
      }
      ack({ ok: true, data: { duplicate: r.value.duplicate } });
    });
    on(EVENTS.chat, ChatSend, (i, ack) => {
      if (!chatLimiter.take(socket.id)) return ack({ ok: false, code: 'RATE_LIMITED', message: 'You are sending messages too quickly.' });
      reply(ack, rooms.chat(seat().code, seat().playerId, i.text));
    });

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) return;
      // Only mark offline if no other socket is still bound to this seat (multiple tabs).
      void io.in(seatChannel(code, playerId)).fetchSockets().then((left) => {
        if (left.length === 0) rooms.setConnected(code, playerId, false);
      });
    });
  });

  return { pushViews };
}
