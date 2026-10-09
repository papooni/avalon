/**
 * Turns a viewer's room view into plain-language guidance: what is happening,
 * whether they must act, and what comes next. Pure and unit-tested.
 * It only reads data the viewer is entitled to, so it cannot leak secrets.
 */
import type { RoomView } from '@/server/rooms';
import { plural } from './text';

export interface Guidance {
  phaseLabel: string;
  headline: string;
  detail: string;
  mustAct: boolean;
  next: string;
}

export function nameOf(view: RoomView, id: string | null | undefined): string {
  if (!id) return 'Someone';
  if (id === view.you.playerId) return 'You';
  return view.members.find((m) => m.playerId === id)?.name ?? 'A player';
}

const ordinal = (i: number) => ['first', 'second', 'third', 'fourth', 'fifth'][i] ?? `${i + 1}th`;

export function guide(view: RoomView): Guidance {
  const g = view.game;
  const me = view.me;
  const spectator = view.you.isSpectator || (!!g && !g.players.includes(view.you.playerId));

  if (!g) {
    const seated = view.members.filter((m) => !m.isSpectator);
    const notReady = seated.filter((m) => !m.ready).length;
    const self = view.members.find((m) => m.playerId === view.you.playerId);
    return {
      phaseLabel: 'Gathering',
      headline: view.you.isHost ? 'Set up the table and start when everyone is ready.' : self?.ready ? 'You are ready.' : 'Tap Ready when you are set.',
      detail:
        seated.length < 5
          ? `Waiting for ${plural(5 - seated.length, 'more player')}. Share the room code ${view.code}.`
          : notReady > 0
            ? `Waiting for ${plural(notReady, 'player')} to get ready.`
            : view.you.isHost
              ? 'Everyone is ready.'
              : 'Everyone is ready. Waiting for the host to start.',
      mustAct: view.you.isHost ? notReady === 0 && seated.length >= 5 : !self?.ready && !spectator,
      next: 'Once the host starts, each player privately sees their role.',
    };
  }

  const leader = nameOf(view, g.leaderId);
  const quest = g.quests[g.questIndex];
  const size = quest?.size ?? 0;
  const questNo = g.questIndex + 1;
  const waitingAck = g.players.length - g.acknowledgedPlayerIds.length;
  const isLeader = g.leaderId === view.you.playerId;
  const proposal = g.proposals.at(-1);

  switch (g.phase) {
    case 'LOBBY':
      return { phaseLabel: 'Starting', headline: 'Dealing roles…', detail: '', mustAct: false, next: '' };
    case 'ROLE_REVEAL':
      return {
        phaseLabel: 'Your role',
        headline: spectator ? 'Players are checking their roles in private.' : me?.hasAcknowledged ? 'Role checked.' : 'Check your role in private.',
        detail: me?.hasAcknowledged || spectator ? `Waiting for ${plural(waitingAck, 'player')}.` : 'Make sure nobody can see your screen, then press and hold the card.',
        mustAct: !spectator && !me?.hasAcknowledged,
        next: 'Next, each player sees what their role lets them know about others.',
      };
    case 'KNOWLEDGE_REVEAL':
      return {
        phaseLabel: 'What you know',
        headline: spectator ? 'Players are reviewing their secret knowledge.' : me?.hasAcknowledged ? 'Knowledge reviewed.' : 'See what you know about the others.',
        detail: me?.hasAcknowledged || spectator ? `Waiting for ${plural(waitingAck, 'player')}.` : 'Press and hold to reveal. Remember it; it will not be shown again during play.',
        mustAct: !spectator && !me?.hasAcknowledged,
        next: `Then ${leader === 'You' ? 'you' : leader} will lead the ${ordinal(0)} quest.`,
      };
    case 'TEAM_PROPOSAL':
      return isLeader
        ? {
            phaseLabel: `Quest ${questNo}`,
            headline: `You are the leader. Select ${size} players for the quest.`,
            detail: 'You may include yourself. Talk it through with the table, then propose the team.',
            mustAct: true,
            next: 'Everyone, including you, then votes on your team.',
          }
        : {
            phaseLabel: `Quest ${questNo}`,
            headline: `${leader} is choosing ${size} players for quest ${questNo}.`,
            detail: 'Discuss who should go. You will vote on the team once it is proposed.',
            mustAct: false,
            next: 'Next, everyone votes to approve or reject the team.',
          };
    case 'TEAM_VOTING': {
      const remaining = g.players.length - g.votedPlayerIds.length;
      return {
        phaseLabel: `Quest ${questNo} vote`,
        headline: spectator
          ? `The table is voting on ${leader === 'You' ? 'your' : `${leader}’s`} team.`
          : me?.hasVoted
            ? `Your vote is locked. Waiting for ${plural(remaining, 'player')}.`
            : `Vote on ${isLeader ? 'your' : `${leader}’s`} team.`,
        detail: me?.hasVoted || spectator ? 'All votes are revealed together.' : 'Approve if you trust everyone on it. A tie counts as a rejection.',
        mustAct: !spectator && !me?.hasVoted,
        next:
          g.consecutiveRejections === 4
            ? 'Warning: if this team is rejected, Evil wins immediately.'
            : 'If most players approve, the team goes on the quest. Otherwise leadership passes on.',
      };
    }
    case 'VOTE_REVEAL': {
      const votes = proposal?.votes ?? {};
      const a = Object.values(votes).filter(Boolean).length;
      const r = Object.values(votes).length - a;
      const fifth = !proposal?.approved && g.consecutiveRejections >= 5;
      return {
        phaseLabel: 'Votes revealed',
        headline: proposal?.approved ? `The team was approved, ${a} to ${r}.` : fifth ? 'Five teams in a row were rejected. Evil wins.' : `The team was rejected, ${a} to ${r}.`,
        detail: proposal?.approved
          ? 'The team now heads out on the quest.'
          : fifth
            ? ''
            : `${plural(g.consecutiveRejections, 'rejection')} in a row. At five, Evil wins.`,
        mustAct: !spectator && !me?.hasAcknowledged,
        next: proposal?.approved ? 'Team members secretly choose a quest card.' : fifth ? 'See the final results.' : 'Leadership passes to the next player.',
      };
    }
    case 'QUEST_ACTION': {
      const remaining = (quest?.team.length ?? 0) - g.questCardsPlayed;
      if (me?.isOnQuestTeam) {
        return {
          phaseLabel: `Quest ${questNo}`,
          headline: me.hasPlayedQuestCard ? `Your card is played. Waiting for ${plural(remaining, 'player')}.` : 'Choose your quest card in secret.',
          detail: me.canFail ? 'You may play Success or Fail.' : 'Loyal players always play Success.',
          mustAct: !me.hasPlayedQuestCard,
          next: 'Cards are shuffled before they are shown, so nobody can tell who played what.',
        };
      }
      return {
        phaseLabel: `Quest ${questNo}`,
        headline: 'You are not on this quest. Watch the discussion while the team decides.',
        detail: `${g.questCardsPlayed} of ${quest?.team.length ?? 0} cards played.`,
        mustAct: false,
        next: quest && quest.failsRequired > 1 ? `This quest fails only if ${quest.failsRequired} Fail cards are played.` : 'A single Fail card makes this quest fail.',
      };
    }
    case 'QUEST_REVEAL':
      return {
        phaseLabel: `Quest ${questNo} result`,
        headline: quest?.result === 'SUCCESS' ? `Quest ${questNo} succeeded.` : `Quest ${questNo} failed.`,
        detail: `${plural(quest?.failCount ?? 0, 'Fail card')} played.${quest && quest.failsRequired > 1 ? ` This quest needed ${quest.failsRequired} to fail.` : ''}`,
        mustAct: !spectator && !me?.hasAcknowledged,
        next: 'The board updates and the next round begins.',
      };
    case 'ROUND_RESULT': {
      const s = g.quests.filter((q) => q.result === 'SUCCESS').length;
      const f = g.quests.filter((q) => q.result === 'FAIL').length;
      return {
        phaseLabel: 'Standing',
        headline: `Good has ${plural(s, 'success', 'successes')}. Evil has ${plural(f, 'failure')}.`,
        detail: s >= 3 ? 'Good has completed three quests.' : f >= 3 ? 'Evil has sabotaged three quests.' : 'First side to three wins the quests.',
        mustAct: !spectator && !me?.hasAcknowledged,
        next: s >= 3 ? 'The Assassin gets one chance to find Merlin.' : f >= 3 ? 'Evil wins.' : 'Leadership passes to the next player.',
      };
    }
    case 'ASSASSINATION':
      if (me?.isAssassin) {
        return {
          phaseLabel: 'Assassination',
          headline: 'Three quests succeeded. Choose who you believe is Merlin.',
          detail: 'Talk with your fellow traitors first. Your choice is final.',
          mustAct: true,
          next: 'If you find Merlin, Evil wins. Otherwise, Good wins.',
        };
      }
      return {
        phaseLabel: 'Assassination',
        headline: 'Three successful quests were completed. The Assassin must now identify Merlin.',
        detail: me?.alignment === 'EVIL' ? 'Help the Assassin decide.' : 'Good players should stay quiet and give nothing away.',
        mustAct: false,
        next: 'One choice decides the game.',
      };
    case 'GAME_OVER': {
      const reasons: Record<string, string> = {
        THREE_QUESTS_SUCCEEDED: 'Three quests succeeded.',
        MERLIN_SURVIVED: `The Assassin chose ${nameOf(view, g.assassinationTarget)}, who was not Merlin.`,
        THREE_QUESTS_FAILED: 'Three quests failed.',
        FIVE_REJECTIONS: 'Five teams in a row were rejected.',
        MERLIN_ASSASSINATED: `The Assassin found Merlin: ${nameOf(view, g.assassinationTarget)}.`,
      };
      return {
        phaseLabel: 'Game over',
        headline: g.winner === 'GOOD' ? 'Good wins.' : 'Evil wins.',
        detail: reasons[g.winReason ?? ''] ?? '',
        mustAct: false,
        next: view.you.isHost ? 'Start a rematch with the same table whenever you like.' : 'The host can start a rematch.',
      };
    }
  }
}

/** Public, secret-free explanation of the current phase for the “Why?” dialog. */
export const PHASE_RULES: Record<string, { title: string; body: string[] }> = {
  LOBBY: {
    title: 'Before the game',
    body: [
      'Five to ten people play. Most are Good; a hidden few are Evil.',
      'Good wants three quests to succeed. Evil wants three to fail.',
      'Everyone gets ready, then the host deals secret roles.',
    ],
  },
  ROLE_REVEAL: { title: 'Secret roles', body: ['Each player sees only their own role.', 'Keep it hidden. You can talk about anything, but you can never show your screen.'] },
  KNOWLEDGE_REVEAL: {
    title: 'Secret knowledge',
    body: ['Some roles learn things about other players: for example, most Evil players know each other.', 'Many players learn nothing, and that is normal.'],
  },
  TEAM_PROPOSAL: {
    title: 'Choosing a team',
    body: [
      'The leader picks exactly the number of players this quest needs, and may include themselves.',
      'Everyone can discuss and try to persuade the leader.',
      'Leadership moves to the next player after every proposal.',
    ],
  },
  TEAM_VOTING: {
    title: 'Voting on the team',
    body: [
      'Everyone votes, including the leader and the chosen players.',
      'Votes stay hidden until all are in, then appear together.',
      'More than half must approve. A tie is a rejection. Five rejections in a row hand Evil the win.',
    ],
  },
  VOTE_REVEAL: { title: 'Reading the votes', body: ['Everyone’s vote is public now. Who approved suspicious teams is valuable evidence.'] },
  QUEST_ACTION: {
    title: 'The quest',
    body: [
      'Only team members play a card, in secret.',
      'Good players must play Success. Evil players may play Success or Fail.',
      'Usually one Fail sinks the quest. With seven or more players, the fourth quest needs two Fails.',
    ],
  },
  QUEST_REVEAL: { title: 'Quest result', body: ['Cards are shuffled before reveal, so you only learn how many Fails were played, never by whom.'] },
  ROUND_RESULT: { title: 'The board', body: ['First side to three quests wins the board. Good still has to survive the Assassin.'] },
  ASSASSINATION: {
    title: 'The Assassin',
    body: ['When Good completes three quests, the Assassin names one player.', 'If that player is Merlin, Evil steals the win. Otherwise Good wins.'],
  },
  GAME_OVER: { title: 'Game over', body: ['Review the recap to see how each vote and quest played out, then start a rematch.'] },
};
