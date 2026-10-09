import { z } from 'zod';
import { ROOM_CODE_PATTERN } from './roomCode';

/**
 * Every client → server message is validated here before it reaches the
 * RoomManager. Unknown keys are stripped; oversized payloads are rejected.
 */

const roomCode = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(ROOM_CODE_PATTERN, 'Room codes are 6 letters and numbers.'));
const name = z.string().max(64);
const avatar = z.string().max(16).optional();
const playerId = z.string().uuid();
const commandId = z.string().min(8).max(64);
const stepId = z.number().int().nonnegative();

export const CreateRoom = z.object({ name, avatar });
export const JoinRoom = z.object({ code: roomCode, name, avatar, asSpectator: z.boolean().optional() });
export const ResumeRoom = z.object({ code: roomCode, token: z.string().min(20).max(128) });
export const SetReady = z.object({ ready: z.boolean() });
export const TargetPlayer = z.object({ playerId });
export const Empty = z.object({}).strict().or(z.undefined()).transform(() => ({}));
export const ChatSend = z.object({ text: z.string().max(1000) });

export const UpdateSettings = z
  .object({
    optionalRoles: z.array(z.string().max(32)).max(8),
    tutorial: z.boolean(),
    timersEnabled: z.boolean(),
    timerSeconds: z.number().int().min(30).max(600),
    allowSpectators: z.boolean(),
    chatEnabled: z.boolean(),
    revealRolesAtEnd: z.boolean(),
    assassinationTargets: z.enum(['NOT_KNOWN_EVIL', 'ANY_OTHER_PLAYER']),
    listed: z.boolean(),
  })
  .partial()
  .strict();

export const GameCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ACKNOWLEDGE'), commandId, stepId }),
  z.object({ type: z.literal('DRAFT_TEAM'), commandId, stepId, team: z.array(playerId).max(10) }),
  z.object({ type: z.literal('PROPOSE_TEAM'), commandId, stepId, team: z.array(playerId).max(10) }),
  z.object({ type: z.literal('CAST_VOTE'), commandId, stepId, approve: z.boolean() }),
  z.object({ type: z.literal('SUBMIT_QUEST_CARD'), commandId, stepId, card: z.enum(['SUCCESS', 'FAIL']) }),
  z.object({ type: z.literal('ASSASSINATE'), commandId, stepId, targetId: playerId }),
]);
export type GameCommandInput = z.infer<typeof GameCommand>;

export type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; code: string; message: string };

export const EVENTS = {
  create: 'room:create',
  join: 'room:join',
  resume: 'room:resume',
  list: 'rooms:list',
  ready: 'lobby:ready',
  settings: 'lobby:settings',
  remove: 'lobby:remove',
  transfer: 'lobby:transfer',
  start: 'lobby:start',
  leave: 'lobby:leave',
  takeSeat: 'lobby:take-seat',
  rematch: 'game:rematch',
  command: 'game:command',
  chat: 'chat:send',
  /** server → client */
  view: 'room:view',
  kicked: 'room:removed',
} as const;
