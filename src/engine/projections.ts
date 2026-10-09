import { assassinOf, assassinationCandidates, currentLeader, currentProposal, isAckPhase } from './engine';
import { knowledgeFor, type KnowledgeEntry } from './knowledge';
import { getRole } from './roles';
import type { Alignment, GameState, Phase, PlayerId, ProposalRecord, QuestRecord, RoleId, WinReason, Winner } from './types';

/**
 * Projections are the ONLY sanctioned way to send game state to a client.
 * The full GameState must never leave the server.
 *
 * Invariants (enforced by tests in __tests__/projections.test.ts):
 * - Public state contains no roles (except the end-of-game reveal when enabled),
 *   no pending votes, and no quest-card authors.
 * - Private state contains only the viewer's own role and their entitled knowledge.
 */

export interface PublicQuest {
  index: number;
  size: number;
  failsRequired: number;
  result: QuestRecord['result'];
  team: PlayerId[];
  successCount: number | null;
  failCount: number | null;
  revealedCards: QuestRecord['revealedCards'];
}

export interface PublicGameState {
  id: string;
  version: number;
  stepId: number;
  phase: Phase;
  players: PlayerId[];
  leaderId: PlayerId | null;
  questIndex: number;
  quests: PublicQuest[];
  consecutiveRejections: number;
  proposals: ProposalRecord[];
  draftTeam: PlayerId[];
  /** Who has voted in the current vote — never how. */
  votedPlayerIds: PlayerId[];
  /** How many quest cards have been played — never by whom or which. */
  questCardsPlayed: number;
  acknowledgedPlayerIds: PlayerId[];
  winner: Winner | null;
  winReason: WinReason | null;
  assassinationTarget: PlayerId | null;
  /** Only populated at GAME_OVER when config.revealRolesAtEnd is true. */
  finalRoles: Record<PlayerId, RoleId> | null;
  assassinationTargetsPolicy: GameState['config']['assassinationTargets'];
  optionalRoles: RoleId[];
}

export interface PrivatePlayerState {
  playerId: PlayerId;
  roleId: RoleId;
  alignment: Alignment;
  knowledge: KnowledgeEntry[];
  canFail: boolean;
  isLeader: boolean;
  isOnQuestTeam: boolean;
  hasVoted: boolean;
  /** The viewer's own pending vote, so their device can show "you voted Approve". */
  myPendingVote: boolean | null;
  hasPlayedQuestCard: boolean;
  hasAcknowledged: boolean;
  isAssassin: boolean;
  assassinationCandidates: PlayerId[];
}

export function getPublicGameState(state: GameState): PublicGameState {
  const inQuest = state.phase === 'QUEST_ACTION';
  return {
    id: state.id,
    version: state.version,
    stepId: state.stepId,
    phase: state.phase,
    players: state.players.slice(),
    leaderId: state.phase === 'LOBBY' ? null : currentLeader(state),
    questIndex: state.questIndex,
    quests: state.quests.map((q) => ({
      index: q.index,
      size: q.size,
      failsRequired: q.failsRequired,
      result: q.result,
      team: q.team.slice(),
      successCount: q.result ? q.successCount : null,
      failCount: q.result ? q.failCount : null,
      revealedCards: q.revealedCards.slice(),
    })),
    consecutiveRejections: state.consecutiveRejections,
    // Votes inside proposals are already null until revealed (see resolveVotes).
    proposals: state.proposals.map((p) => ({ ...p, team: p.team.slice(), votes: p.votes ? { ...p.votes } : null })),
    draftTeam: state.draftTeam.slice(),
    votedPlayerIds: state.phase === 'TEAM_VOTING' ? Object.keys(state.pendingVotes) : [],
    questCardsPlayed: inQuest ? Object.keys(state.pendingQuestCards).length : 0,
    acknowledgedPlayerIds: isAckPhase(state.phase) ? state.acknowledged.slice() : [],
    winner: state.winner,
    winReason: state.winReason,
    assassinationTarget: state.assassinationTarget,
    finalRoles: state.phase === 'GAME_OVER' && state.config.revealRolesAtEnd ? { ...state.roles } : null,
    assassinationTargetsPolicy: state.config.assassinationTargets,
    optionalRoles: state.config.optionalRoles.slice(),
  };
}

/**
 * Private projection for one player. Throws if `playerId` is not seated, so
 * callers cannot accidentally project for spectators or strangers.
 */
export function getPrivatePlayerState(state: GameState, playerId: PlayerId): PrivatePlayerState | null {
  if (!state.players.includes(playerId)) throw new Error('Not a seated player');
  const roleId = state.roles[playerId];
  if (!roleId) return null; // Roles not assigned yet (LOBBY).
  const role = getRole(roleId);
  const isAssassin = role.abilities.includes('ASSASSINATE');
  const quest = state.quests[state.questIndex];
  const proposal = currentProposal(state);
  return {
    playerId,
    roleId,
    alignment: role.alignment,
    knowledge: knowledgeFor(state, playerId),
    canFail: role.canFail,
    isLeader: currentLeader(state) === playerId,
    isOnQuestTeam: !!quest && quest.team.includes(playerId) && !!proposal?.approved,
    hasVoted: state.phase === 'TEAM_VOTING' && playerId in state.pendingVotes,
    myPendingVote: state.phase === 'TEAM_VOTING' ? (state.pendingVotes[playerId] ?? null) : null,
    hasPlayedQuestCard: state.phase === 'QUEST_ACTION' && playerId in state.pendingQuestCards,
    hasAcknowledged: state.acknowledged.includes(playerId),
    isAssassin,
    assassinationCandidates:
      isAssassin && state.phase === 'ASSASSINATION' && assassinOf(state) === playerId
        ? assassinationCandidates(state, playerId)
        : [],
  };
}
