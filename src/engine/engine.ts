import { knownEvilFor } from './knowledge';
import { shuffle } from './random';
import { getRole } from './roles';
import {
  DEFAULT_CONFIG,
  MAX_CONSECUTIVE_REJECTIONS,
  QUESTS_TO_WIN,
  buildRoleDeck,
  hasBlockingIssues,
  rulesFor,
  validateConfig,
} from './rules';
import type {
  AckPhase,
  Actor,
  ApplyResult,
  Command,
  EngineEvent,
  GameConfig,
  GameState,
  Phase,
  PlayerId,
  QuestCard,
  Rejection,
  RejectionCode,
  Rng,
  ValidationResult,
  WinReason,
  Winner,
} from './types';
import { ACK_PHASES } from './types';

const MAX_REMEMBERED_COMMANDS = 1000;

/**
 * Allowed commands per phase. This table *is* the state machine's input
 * alphabet; anything not listed is rejected with WRONG_PHASE.
 */
export const COMMANDS_BY_PHASE: Record<Phase, ReadonlyArray<Command['type']>> = {
  LOBBY: ['START_GAME'],
  ROLE_REVEAL: ['ACKNOWLEDGE', 'ADVANCE'],
  KNOWLEDGE_REVEAL: ['ACKNOWLEDGE', 'ADVANCE'],
  TEAM_PROPOSAL: ['DRAFT_TEAM', 'PROPOSE_TEAM'],
  TEAM_VOTING: ['CAST_VOTE'],
  VOTE_REVEAL: ['ACKNOWLEDGE', 'ADVANCE'],
  QUEST_ACTION: ['SUBMIT_QUEST_CARD'],
  QUEST_REVEAL: ['ACKNOWLEDGE', 'ADVANCE'],
  ROUND_RESULT: ['ACKNOWLEDGE', 'ADVANCE'],
  ASSASSINATION: ['ASSASSINATE'],
  GAME_OVER: [],
};

/** Every transition the machine can take. Used for documentation and tests. */
export const TRANSITIONS: Record<Phase, ReadonlyArray<Phase>> = {
  LOBBY: ['ROLE_REVEAL'],
  ROLE_REVEAL: ['KNOWLEDGE_REVEAL'],
  KNOWLEDGE_REVEAL: ['TEAM_PROPOSAL'],
  TEAM_PROPOSAL: ['TEAM_VOTING'],
  TEAM_VOTING: ['VOTE_REVEAL'],
  VOTE_REVEAL: ['QUEST_ACTION', 'TEAM_PROPOSAL', 'GAME_OVER'],
  QUEST_ACTION: ['QUEST_REVEAL'],
  QUEST_REVEAL: ['ROUND_RESULT'],
  ROUND_RESULT: ['TEAM_PROPOSAL', 'ASSASSINATION', 'GAME_OVER'],
  ASSASSINATION: ['GAME_OVER'],
  GAME_OVER: [],
};

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createGame(id: string, players: PlayerId[], config: Partial<GameConfig> = {}): GameState {
  if (new Set(players).size !== players.length) throw new Error('Duplicate player ids');
  return {
    id,
    version: 0,
    stepId: 0,
    phase: 'LOBBY',
    players: players.slice(),
    config: { ...DEFAULT_CONFIG, ...config, optionalRoles: [...(config.optionalRoles ?? [])] },
    roles: {},
    pendingVotes: {},
    pendingQuestCards: {},
    questIndex: 0,
    leaderIndex: 0,
    consecutiveRejections: 0,
    quests: [],
    proposals: [],
    acknowledged: [],
    draftTeam: [],
    assassinationTarget: null,
    winner: null,
    winReason: null,
    processedCommandIds: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reject(code: RejectionCode, message: string): { ok: false; error: Rejection } {
  return { ok: false, error: { code, message } };
}

export function currentLeader(state: GameState): PlayerId {
  return state.players[state.leaderIndex]!;
}

export function currentQuestSize(state: GameState): number {
  return state.quests[state.questIndex]?.size ?? 0;
}

export function currentProposal(state: GameState) {
  return state.proposals[state.proposals.length - 1] ?? null;
}

export function isAckPhase(phase: Phase): phase is AckPhase {
  return (ACK_PHASES as readonly Phase[]).includes(phase);
}

function playerHasAbility(state: GameState, playerId: PlayerId, ability: 'ASSASSINATE'): boolean {
  const roleId = state.roles[playerId];
  return !!roleId && getRole(roleId).abilities.includes(ability);
}

export function assassinOf(state: GameState): PlayerId | null {
  return state.players.find((p) => playerHasAbility(state, p, 'ASSASSINATE')) ?? null;
}

/** Valid assassination targets for the assassin, computed without leaking more than they already know. */
export function assassinationCandidates(state: GameState, assassinId: PlayerId): PlayerId[] {
  const known = state.config.assassinationTargets === 'NOT_KNOWN_EVIL' ? knownEvilFor(state, assassinId) : new Set();
  return state.players.filter((p) => p !== assassinId && !known.has(p));
}

function validateTeam(state: GameState, team: PlayerId[], exactSize: boolean): Rejection | null {
  const size = currentQuestSize(state);
  if (new Set(team).size !== team.length) return { code: 'INVALID_TEAM', message: 'A player can only be chosen once.' };
  if (team.some((p) => !state.players.includes(p))) return { code: 'INVALID_TEAM', message: 'Only seated players can go on a quest.' };
  if (exactSize && team.length !== size) {
    return { code: 'INVALID_TEAM', message: `This quest needs exactly ${size} players. You chose ${team.length}.` };
  }
  if (!exactSize && team.length > size) return { code: 'INVALID_TEAM', message: `This quest takes at most ${size} players.` };
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCommand(state: GameState, command: Command, actor: Actor): ValidationResult {
  if (state.phase === 'GAME_OVER') return reject('GAME_OVER', 'This game has ended.');
  if (!COMMANDS_BY_PHASE[state.phase].includes(command.type)) {
    return reject('WRONG_PHASE', 'That action is not available right now.');
  }

  // System-only commands.
  if (command.type === 'START_GAME' || command.type === 'ADVANCE') {
    if (actor.kind !== 'system') return reject('NOT_AUTHORIZED', 'Only the server can do that.');
  } else {
    if (actor.kind !== 'player' || !actor.playerId || !state.players.includes(actor.playerId)) {
      return reject('NOT_A_PLAYER', 'Only seated players can act in this game.');
    }
  }

  if ('stepId' in command && command.stepId !== state.stepId) {
    return reject('STALE_STEP', 'The game moved on before your action arrived.');
  }

  const me = actor.playerId!;

  switch (command.type) {
    case 'START_GAME': {
      const issues = validateConfig(state.config, state.players.length);
      if (hasBlockingIssues(issues)) {
        return reject('INVALID_CONFIG', issues.find((i) => i.severity === 'error')!.message);
      }
      return { ok: true };
    }
    case 'ADVANCE':
      return { ok: true };
    case 'ACKNOWLEDGE':
      if (state.acknowledged.includes(me)) return reject('ALREADY_ACTED', 'You have already continued.');
      return { ok: true };
    case 'DRAFT_TEAM':
    case 'PROPOSE_TEAM': {
      if (currentLeader(state) !== me) return reject('NOT_AUTHORIZED', 'Only the leader chooses the team.');
      const err = validateTeam(state, command.team, command.type === 'PROPOSE_TEAM');
      return err ? { ok: false, error: err } : { ok: true };
    }
    case 'CAST_VOTE':
      if (me in state.pendingVotes) return reject('ALREADY_ACTED', 'Your vote is already locked in.');
      return { ok: true };
    case 'SUBMIT_QUEST_CARD': {
      const quest = state.quests[state.questIndex]!;
      if (!quest.team.includes(me)) return reject('NOT_ON_TEAM', 'Only players on this quest can play a card.');
      if (me in state.pendingQuestCards) return reject('ALREADY_ACTED', 'You have already played your card.');
      if (command.card === 'FAIL' && !getRole(state.roles[me]!).canFail) {
        return reject('CARD_NOT_ALLOWED', 'Loyal players can only play Success.');
      }
      return { ok: true };
    }
    case 'ASSASSINATE': {
      if (!playerHasAbility(state, me, 'ASSASSINATE')) return reject('NOT_AUTHORIZED', 'Only the Assassin can choose a target.');
      if (!assassinationCandidates(state, me).includes(command.targetId)) {
        return reject('INVALID_TARGET', 'Choose a player you do not already know to be Evil.');
      }
      return { ok: true };
    }
  }
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

function commandKey(command: Command, actor: Actor): string {
  return `${actor.kind === 'system' ? 'system' : actor.playerId}:${command.commandId}`;
}

function enterPhase(state: GameState, to: Phase, events: EngineEvent[]): void {
  const from = state.phase;
  if (!TRANSITIONS[from].includes(to)) throw new Error(`Illegal transition ${from} -> ${to}`);
  state.phase = to;
  state.stepId += 1;
  state.acknowledged = [];
  events.push({ type: 'PHASE_CHANGED', from, to });
}

function rotateLeader(state: GameState, events: EngineEvent[]): void {
  state.leaderIndex = (state.leaderIndex + 1) % state.players.length;
  state.draftTeam = [];
  events.push({ type: 'LEADER_CHANGED', leaderId: currentLeader(state) });
}

function endGame(state: GameState, winner: Winner, reason: WinReason, events: EngineEvent[]): void {
  state.winner = winner;
  state.winReason = reason;
  enterPhase(state, 'GAME_OVER', events);
  events.push({ type: 'GAME_ENDED', winner, reason });
}

function startGame(state: GameState, rng: Rng, events: EngineEvent[]): void {
  const n = state.players.length;
  const rules = rulesFor(n);
  const deck = shuffle(buildRoleDeck(state.config, n), rng);
  state.roles = Object.fromEntries(state.players.map((p, i) => [p, deck[i]!]));
  state.quests = rules.questSizes.map((size, index) => ({
    index,
    size,
    failsRequired: rules.failsRequired[index]!,
    result: null,
    team: [],
    successCount: 0,
    failCount: 0,
    revealedCards: [],
  }));
  state.leaderIndex = rng.int(n);
  events.push({ type: 'GAME_STARTED', leaderId: currentLeader(state) });
  enterPhase(state, 'ROLE_REVEAL', events);
}

/** Leaves an acknowledgement phase. */
function advance(state: GameState, events: EngineEvent[]): void {
  switch (state.phase) {
    case 'ROLE_REVEAL':
      return enterPhase(state, 'KNOWLEDGE_REVEAL', events);
    case 'KNOWLEDGE_REVEAL':
      return enterPhase(state, 'TEAM_PROPOSAL', events);
    case 'VOTE_REVEAL': {
      const proposal = currentProposal(state)!;
      if (proposal.approved) return enterPhase(state, 'QUEST_ACTION', events);
      if (state.consecutiveRejections >= MAX_CONSECUTIVE_REJECTIONS) {
        return endGame(state, 'EVIL', 'FIVE_REJECTIONS', events);
      }
      rotateLeader(state, events);
      return enterPhase(state, 'TEAM_PROPOSAL', events);
    }
    case 'QUEST_REVEAL':
      return enterPhase(state, 'ROUND_RESULT', events);
    case 'ROUND_RESULT': {
      const successes = state.quests.filter((q) => q.result === 'SUCCESS').length;
      const fails = state.quests.filter((q) => q.result === 'FAIL').length;
      if (fails >= QUESTS_TO_WIN) return endGame(state, 'EVIL', 'THREE_QUESTS_FAILED', events);
      if (successes >= QUESTS_TO_WIN) {
        if (assassinOf(state)) return enterPhase(state, 'ASSASSINATION', events);
        return endGame(state, 'GOOD', 'THREE_QUESTS_SUCCEEDED', events);
      }
      state.questIndex += 1;
      rotateLeader(state, events);
      return enterPhase(state, 'TEAM_PROPOSAL', events);
    }
    default:
      throw new Error(`advance() called in non-ack phase ${state.phase}`);
  }
}

function resolveVotes(state: GameState, events: EngineEvent[]): void {
  const proposal = currentProposal(state)!;
  const votes = { ...state.pendingVotes };
  const approvals = Object.values(votes).filter(Boolean).length;
  const total = state.players.length;
  const approved = approvals * 2 > total; // strict majority; ties reject (R-VOTE-3, R-VOTE-4)
  proposal.votes = votes;
  proposal.approved = approved;
  state.pendingVotes = {};
  if (approved) {
    state.consecutiveRejections = 0;
    state.quests[state.questIndex]!.team = proposal.team.slice();
  } else {
    state.consecutiveRejections += 1;
  }
  events.push({ type: 'VOTES_REVEALED', proposalId: proposal.id, approved, approvals, rejections: total - approvals });
  enterPhase(state, 'VOTE_REVEAL', events);
}

function resolveQuest(state: GameState, rng: Rng, events: EngineEvent[]): void {
  const quest = state.quests[state.questIndex]!;
  // Drop the author mapping before anything else touches the cards.
  const cards: QuestCard[] = shuffle(Object.values(state.pendingQuestCards), rng);
  state.pendingQuestCards = {};
  quest.failCount = cards.filter((c) => c === 'FAIL').length;
  quest.successCount = cards.length - quest.failCount;
  quest.revealedCards = cards;
  quest.result = quest.failCount >= quest.failsRequired ? 'FAIL' : 'SUCCESS';
  events.push({ type: 'QUEST_RESOLVED', questIndex: quest.index, result: quest.result, failCount: quest.failCount });
  enterPhase(state, 'QUEST_REVEAL', events);
}

/**
 * Applies automatic transitions that follow from the current state
 * (all votes in, all cards in, everyone acknowledged). Idempotent.
 */
export function determineNextState(input: GameState, rng: Rng, events: EngineEvent[] = []): GameState {
  const state = input;
  for (;;) {
    if (state.phase === 'TEAM_VOTING' && Object.keys(state.pendingVotes).length === state.players.length) {
      resolveVotes(state, events);
      continue;
    }
    if (state.phase === 'QUEST_ACTION') {
      const team = state.quests[state.questIndex]!.team;
      if (team.every((p) => p in state.pendingQuestCards)) {
        resolveQuest(state, rng, events);
        continue;
      }
    }
    if (isAckPhase(state.phase) && state.players.every((p) => state.acknowledged.includes(p))) {
      advance(state, events);
      continue;
    }
    return state;
  }
}

export function applyCommand(input: GameState, command: Command, actor: Actor, rng: Rng): ApplyResult {
  const key = commandKey(command, actor);
  if (input.processedCommandIds.includes(key)) {
    return { ok: true, state: input, duplicate: true, events: [] };
  }
  const validation = validateCommand(input, command, actor);
  if (!validation.ok) return validation;

  const state: GameState = structuredClone(input);
  const events: EngineEvent[] = [];
  const me = actor.playerId!;

  switch (command.type) {
    case 'START_GAME':
      startGame(state, rng, events);
      break;
    case 'ADVANCE':
      advance(state, events);
      break;
    case 'ACKNOWLEDGE':
      state.acknowledged.push(me);
      break;
    case 'DRAFT_TEAM':
      state.draftTeam = command.team.slice();
      break;
    case 'PROPOSE_TEAM':
      state.proposals.push({
        id: state.proposals.length + 1,
        questIndex: state.questIndex,
        attempt: state.consecutiveRejections + 1,
        leaderId: me,
        team: command.team.slice(),
        votes: null,
        approved: null,
      });
      state.draftTeam = command.team.slice();
      events.push({ type: 'TEAM_PROPOSED', leaderId: me, team: command.team.slice(), questIndex: state.questIndex });
      enterPhase(state, 'TEAM_VOTING', events);
      break;
    case 'CAST_VOTE':
      state.pendingVotes[me] = command.approve;
      break;
    case 'SUBMIT_QUEST_CARD':
      state.pendingQuestCards[me] = command.card;
      break;
    case 'ASSASSINATE': {
      const hit = getRole(state.roles[command.targetId]!).tags.includes('ASSASSINATION_TARGET');
      state.assassinationTarget = command.targetId;
      events.push({ type: 'ASSASSINATION', targetId: command.targetId, hitMerlin: hit });
      endGame(state, hit ? 'EVIL' : 'GOOD', hit ? 'MERLIN_ASSASSINATED' : 'MERLIN_SURVIVED', events);
      break;
    }
  }

  determineNextState(state, rng, events);
  state.version += 1;
  state.processedCommandIds.push(key);
  if (state.processedCommandIds.length > MAX_REMEMBERED_COMMANDS) {
    state.processedCommandIds.splice(0, state.processedCommandIds.length - MAX_REMEMBERED_COMMANDS);
  }
  return { ok: true, state, duplicate: false, events };
}
