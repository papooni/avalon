import {
  applyCommand,
  createGame,
  seededRng,
  type Actor,
  type Command,
  type GameConfig,
  type GameState,
  type PlayerId,
  type QuestCard,
  type RoleId,
  type Rng,
} from '../index';

let counter = 0;
export const cid = () => `cmd-${++counter}`;
export const sys: Actor = { kind: 'system' };
export const as = (playerId: PlayerId): Actor => ({ kind: 'player', playerId });
export const playersN = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

export function mustApply(state: GameState, command: Command, actor: Actor, rng: Rng = seededRng(1)): GameState {
  const r = applyCommand(state, command, actor, rng);
  if (!r.ok) throw new Error(`Command ${command.type} rejected: ${r.error.code} ${r.error.message}`);
  return r.state;
}

/** Starts a game and optionally overrides roles so tests are explicit about who is who. */
export function startedGame(n: number, config: Partial<GameConfig> = {}, roles?: RoleId[], seed = 7): GameState {
  let s = createGame('g1', playersN(n), config);
  s = mustApply(s, { type: 'START_GAME', commandId: cid() }, sys, seededRng(seed));
  if (roles) {
    s = { ...s, roles: Object.fromEntries(s.players.map((p, i) => [p, roles[i]!])) };
  }
  return s;
}

export function ackAll(s: GameState): GameState {
  let state = s;
  const step = state.stepId;
  for (const p of state.players) {
    if (state.stepId !== step) break;
    state = mustApply(state, { type: 'ACKNOWLEDGE', commandId: cid(), stepId: state.stepId }, as(p));
  }
  return state;
}

export function toTeamProposal(s: GameState): GameState {
  let state = s;
  while (state.phase === 'ROLE_REVEAL' || state.phase === 'KNOWLEDGE_REVEAL') state = ackAll(state);
  return state;
}

export function leader(s: GameState): PlayerId {
  return s.players[s.leaderIndex]!;
}

export function propose(s: GameState, team?: PlayerId[]): GameState {
  const size = s.quests[s.questIndex]!.size;
  const t = team ?? s.players.slice(0, size);
  return mustApply(s, { type: 'PROPOSE_TEAM', commandId: cid(), stepId: s.stepId, team: t }, as(leader(s)));
}

/** All players vote; the first `approvals` players in seat order approve. */
export function voteAll(s: GameState, approvals: number): GameState {
  let state = s;
  state.players.forEach((p, i) => {
    state = mustApply(state, { type: 'CAST_VOTE', commandId: cid(), stepId: state.stepId, approve: i < approvals }, as(p));
  });
  return state;
}

/** Plays a full quest. `fails` = number of team members (that can fail) who play FAIL. */
export function playQuest(s: GameState, fails = 0, team?: PlayerId[]): GameState {
  let state = propose(s, team);
  state = voteAll(state, state.players.length);
  state = ackAll(state); // VOTE_REVEAL -> QUEST_ACTION
  const questTeam = state.quests[state.questIndex]!.team;
  let remainingFails = fails;
  for (const p of questTeam) {
    const roleCanFail = ['ASSASSIN', 'MINION', 'MORGANA', 'MORDRED', 'OBERON'].includes(state.roles[p]!);
    const card: QuestCard = roleCanFail && remainingFails > 0 ? 'FAIL' : 'SUCCESS';
    if (card === 'FAIL') remainingFails--;
    state = mustApply(state, { type: 'SUBMIT_QUEST_CARD', commandId: cid(), stepId: state.stepId, card }, as(p));
  }
  if (remainingFails > 0) throw new Error('Not enough Evil players on the team to play the requested fails');
  state = ackAll(state); // QUEST_REVEAL -> ROUND_RESULT
  state = ackAll(state); // ROUND_RESULT -> next
  return state;
}

export function playerWithRole(s: GameState, role: RoleId): PlayerId {
  const p = s.players.find((x) => s.roles[x] === role);
  if (!p) throw new Error(`No ${role}`);
  return p;
}
