import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { QuestSeal } from '@/components/game/Art';
import { Embers } from '@/components/game/Embers';
import { PublicRooms } from '@/components/game/PublicRooms';
import { BRAND } from '@/lib/branding';
import { SITE, SITE_URL } from '@/lib/site';

// Structured data so search engines can show the site as a free web game.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: BRAND.productName, description: SITE.description, inLanguage: 'en' },
    {
      '@type': ['VideoGame', 'WebApplication'],
      '@id': `${SITE_URL}/#game`,
      name: BRAND.productName,
      url: `${SITE_URL}/`,
      description: SITE.description,
      image: `${SITE_URL}/opengraph-image`,
      applicationCategory: 'GameApplication',
      genre: ['Social deduction', 'Hidden role', 'Party game'],
      gamePlatform: 'Web browser',
      operatingSystem: 'Any',
      playMode: 'MultiPlayer',
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 10 },
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      inLanguage: 'en',
    },
  ],
};

export default function Landing() {
  const seals: Array<'success' | 'fail' | 'pending'> = ['success', 'fail', 'success', 'pending', 'pending'];
  return (
    <main id="main" className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-5 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Embers />
      <div className="flex justify-center gap-2 sm:gap-4" aria-hidden>
        {seals.map((s, i) => (
          <div key={i} className="size-12 sm:size-16">
            <QuestSeal state={s} size={[2, 3, 2, 3, 3][i]!} failsRequired={1} current={i === 3} />
          </div>
        ))}
      </div>
      <div className="space-y-4 text-center">
        <h1 className="text-5xl sm:text-6xl">{BRAND.productName}</h1>
        <p className="mx-auto max-w-md text-lg text-parchment/80">
          Five quests. A table of friends. A few of them are lying. Play together in the same room, each on your own phone.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-sm gap-3">
        <Button asChild size="lg">
          <Link href="/create">Create a room</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/join">Join with a code</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/rules">New to the game? Learn in two minutes</Link>
        </Button>
      </div>
      <PublicRooms />
      <section className="mx-auto max-w-xl space-y-3 text-center text-parchment/75">
        <h2 className="text-2xl text-parchment">A hidden role game for game night</h2>
        <p>
          {BRAND.productName} is a free social deduction game for 5 to 10 players. Loyal knights try to complete three quests while the traitors among them
          sabotage in secret. Merlin knows who the traitors are, but if the Assassin finds Merlin at the end, Evil steals the win.
        </p>
        <p>
          The host creates a room and everyone else joins with a six-letter code, each on their own phone. Nothing to install, no account, and the app deals the
          secret roles and runs every vote for you.
        </p>
      </section>
      <p className="text-center text-xs text-parchment/45">An independent fan adaptation for 5–10 players. Not affiliated with any publisher.</p>
    </main>
  );
}
