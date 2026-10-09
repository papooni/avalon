/**
 * Core types for the deterministic game engine.
 *
 * The engine is pure TypeScript: no I/O, no clocks, no global randomness.
 * Randomness is injected through the `Rng` interface so the server can use
 * crypto-secure randomness while tests use a seeded generator.
 */

export type PlayerId = string;
export type RoleId = string;
export type Alignment = 'GOOD' | 'EVIL';
export type QuestCard = 'SUCCESS' | 'FAIL';
export type Winner = Alignment;

export const PHASES = [
  'LOBBY',
  'ROLE_REVEAL',
  'KNOWLEDGE_REVEAL',
  'TEAM_PROPOSAL',
  'TEAM_VOTING',
  'VOTE_REVEAL',
  'QUEST_ACTION',
  'QUEST_REVEAL',
  'ROUND_RESULT',
  'ASSASSINATION',
  'GAME_OVER',
] as const;
export type Phase = (typeof PHASES)[number];

/** Phases that only wait for players to acknowledge (or the server to advance). */
export const ACK_PHASES = [
  'ROLE_REVEAL',
  'KNOWLEDGE_REVEAL',
  'VOTE_REVEAL',
  'QUEST_REVEAL',
  'ROUND_RESULT',
] as const satisfies readonly Phase[];
export type AckPhase = (typeof ACK_PHASES)[number];

export type WinReason =
  | 'THREE_QUESTS_SUCCEEDED'
  | 'MERLIN_SURVIVED'
  | 'THREE_QUESTS_FAILED'
  | 'FIVE_REJECTIONS'
  | 'MERLIN_ASSASSINATED';

/** A label shown to a player about another player during the knowledge reveal. */
export type KnowledgeLabel = 'EVIL' | 'MERLIN_OR_MORGANA';

export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export interface Actor {
  kind: 'player' | 'system';
  /** Present when kind === 'player'. */
  playerId?: PlayerId;
}

export interface QuestRecord {
  index: number;
  size: number;
  failsRequired: number;
  result: 'SUCCESS' | 'FAIL' | null;
  /** Team that went on the quest (public once approved). */
  team: PlayerId[];
  successCount: number;
  failCount: number;
  /** Shuffled cards in reveal order. Contains no author information. */
  revealedCards: QuestCard[];
}

export interface ProposalRecord {
  id: number;
  questIndex: number;
  /** 1-based attempt number within the current run of rejections. */
  attempt: number;
  leaderId: PlayerId;
  team: PlayerId[];
  /** Only populated after all votes are in (VOTE_REVEAL). */
  votes: Record<PlayerId, boolean> | null;
  approved: boolean | null;
}

export interface GameConfig {
  /** Optional role ids enabled by the host (e.g. PERCIVAL, MORGANA). */
  optionalRoles: RoleId[];
  /** Assassination target policy. See docs/rule-matrix.md (R-ASN-3). */
  assassinationTargets: 'NOT_KNOWN_EVIL' | 'ANY_OTHER_PLAYER';
  /** Whether role cards are revealed to everyone on the game-over screen. */
  revealRolesAtEnd: boolean;
}

export interface GameState {
  id: string;
  /** Monotonic version, incremented by every accepted command. */
  version: number;
  /**
   * Increments on every phase transition. Phase-bound commands must carry the
   * stepId they were issued against; stale or late commands are rejected.
   */
  stepId: number;
  phase: Phase;
  /** Seat order. Leadership rotates through this array. */
  players: PlayerId[];
  config: GameConfig;

  // ---- Secret state (never projected directly) ----
  roles: Record<PlayerId, RoleId>;
  pendingVotes: Record<PlayerId, boolean>;
  pendingQuestCards: Record<PlayerId, QuestCard>;

  // ---- Public state ----
  questIndex: number;
  leaderIndex: number;
  consecutiveRejections: number;
  quests: QuestRecord[];
  proposals: ProposalRecord[];
  /** Players who have acknowledged the current ACK phase. */
  acknowledged: PlayerId[];
  /** Leader's in-progress selection, shared so the table can discuss it. */
  draftTeam: PlayerId[];
  assassinationTarget: PlayerId | null;
  winner: Winner | null;
  winReason: WinReason | null;

  /** Recently processed command ids, for idempotency. Bounded. */
  processedCommandIds: string[];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

interface BaseCommand {
  /** Client-generated idempotency key. */
  commandId: string;
}

export type Command =
  | (BaseCommand & { type: 'START_GAME' })
  | (BaseCommand & { type: 'ACKNOWLEDGE'; stepId: number })
  | (BaseCommand & { type: 'ADVANCE'; stepId: number })
  | (BaseCommand & { type: 'DRAFT_TEAM'; stepId: number; team: PlayerId[] })
  | (BaseCommand & { type: 'PROPOSE_TEAM'; stepId: number; team: PlayerId[] })
  | (BaseCommand & { type: 'CAST_VOTE'; stepId: number; approve: boolean })
  | (BaseCommand & { type: 'SUBMIT_QUEST_CARD'; stepId: number; card: QuestCard })
  | (BaseCommand & { type: 'ASSASSINATE'; stepId: number; targetId: PlayerId });

export type CommandType = Command['type'];

export type RejectionCode =
  | 'WRONG_PHASE'
  | 'STALE_STEP'
  | 'NOT_A_PLAYER'
  | 'NOT_AUTHORIZED'
  | 'ALREADY_ACTED'
  | 'INVALID_TEAM'
  | 'NOT_ON_TEAM'
  | 'CARD_NOT_ALLOWED'
  | 'INVALID_TARGET'
  | 'INVALID_CONFIG'
  | 'GAME_OVER';

export interface Rejection {
  code: RejectionCode;
  /** Player-friendly message. Never contains secret information. */
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; error: Rejection };

export type ApplyResult =
  | { ok: true; state: GameState; duplicate: boolean; events: EngineEvent[] }
  | { ok: false; error: Rejection };

/**
 * Public, non-secret events emitted by the engine for history/recap.
 * Never include roles, pending votes or quest-card authors.
 */
export type EngineEvent =
  | { type: 'GAME_STARTED'; leaderId: PlayerId }
  | { type: 'PHASE_CHANGED'; from: Phase; to: Phase }
  | { type: 'TEAM_PROPOSED'; leaderId: PlayerId; team: PlayerId[]; questIndex: number }
  | { type: 'VOTES_REVEALED'; proposalId: number; approved: boolean; approvals: number; rejections: number }
  | { type: 'QUEST_RESOLVED'; questIndex: number; result: 'SUCCESS' | 'FAIL'; failCount: number }
  | { type: 'LEADER_CHANGED'; leaderId: PlayerId }
  | { type: 'ASSASSINATION'; targetId: PlayerId; hitMerlin: boolean }
  | { type: 'GAME_ENDED'; winner: Winner; reason: WinReason };
