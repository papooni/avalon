import Link from 'next/link';
import type { Metadata } from 'next';
import { RoleSigil, QuestSeal } from '@/components/game/Art';
import { PLAYER_COUNT_RULES } from '@/engine';
import { ROLE_COPY } from '@/lib/branding';

export const metadata: Metadata = { title: 'How to play' };

const SECTIONS = [
  {
    title: 'The idea',
    body: 'Most players are Good and want three quests to succeed. A hidden few are Evil and want three quests to fail. Evil players usually know each other. Good players have to work out who to trust from how people talk, vote and act.',
  },
  {
    title: 'Each round',
    body: 'The leader picks a team of the size shown on the next quest seal. Everyone discusses, then everyone votes in secret. If more than half approve, the team goes on the quest. A tie, or anything less, rejects the team and leadership moves to the next player.',
  },
  {
    title: 'On a quest',
    body: 'Each team member secretly plays Success or Fail. Good players can only play Success. Evil players may play either. The cards are shuffled, so you only learn how many Fails were played. One Fail ruins the quest, except the fourth quest in games of seven or more, which needs two.',
  },
  {
    title: 'Ways to win',
    body: 'Evil wins at once if three quests fail, or if five teams in a row are rejected. If three quests succeed, the Assassin gets one guess at who Merlin is. A correct guess steals the win for Evil. A wrong one means Good wins.',
  },
];

export default function RulesPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl space-y-10 px-5 py-10">
      <Link href="/" className="text-sm text-gilt underline-offset-4 hover:underline">
        Back
      </Link>
      <header className="space-y-2">
        <h1 className="text-5xl">How to play</h1>
        <p className="text-lg text-parchment/80">Everything you need for your first game. The app guides you through each step as you play.</p>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-2xl">{s.title}</h2>
          <p className="text-parchment/85">{s.body}</p>
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="text-2xl">The roles</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {Object.entries(ROLE_COPY).map(([id, copy]) => {
            const evil = ['ASSASSIN', 'MINION', 'MORGANA', 'MORDRED', 'OBERON'].includes(id);
            return (
              <li key={id} className="glass flex gap-3 p-3">
                <RoleSigil roleId={id} alignment={evil ? 'EVIL' : 'GOOD'} className="size-12 shrink-0" />
                <div>
                  <p className="font-display text-lg">
                    {copy.name} <span className={evil ? 'text-sm text-treason-soft' : 'text-sm text-loyal-soft'}>{evil ? 'Evil' : 'Good'}</span>
                  </p>
                  <p className="text-sm text-parchment/75">{copy.summary}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-parchment/65">Merlin and the Assassin are always in the game. Percival, Morgana, Mordred and Oberon are optional and chosen by the host.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Table size</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <caption className="sr-only">Good and Evil players and quest team sizes by player count</caption>
            <thead className="text-parchment/65">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Players</th>
                <th scope="col" className="py-2 pr-3 font-medium">Good</th>
                <th scope="col" className="py-2 pr-3 font-medium">Evil</th>
                <th scope="col" className="py-2 font-medium">Quest teams</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PLAYER_COUNT_RULES).map(([n, r]) => (
                <tr key={n} className="border-t border-white/[0.06]">
                  <th scope="row" className="py-2 pr-3 font-medium">{n}</th>
                  <td className="py-2 pr-3">{r.good}</td>
                  <td className="py-2 pr-3">{r.evil}</td>
                  <td className="py-2">
                    {r.questSizes.map((s, i) => (
                      <span key={i} className="mr-2 inline-block">
                        {s}
                        {r.failsRequired[i]! > 1 ? '*' : ''}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-2 text-sm text-parchment/65">
          <span className="inline-block size-6" aria-hidden>
            <QuestSeal state="pending" size={4} failsRequired={2} current={false} />
          </span>
          * This quest needs two Fail cards to fail.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-2xl">Table manners</h2>
        <p className="text-parchment/85">Talk as much as you like and say anything, but never show your screen. Hold your phone close during the secret reveals.</p>
      </section>
    </main>
  );
}
