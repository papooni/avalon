import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { QuestSeal } from '@/components/game/Art';
import { Embers } from '@/components/game/Embers';
import { PublicRooms } from '@/components/game/PublicRooms';
import { BRAND } from '@/lib/branding';

export default function Landing() {
  const seals: Array<'success' | 'fail' | 'pending'> = ['success', 'fail', 'success', 'pending', 'pending'];
  return (
    <main id="main" className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-5 py-12">
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
      <p className="text-center text-xs text-parchment/45">An independent fan adaptation for 5–10 players. Not affiliated with any publisher.</p>
    </main>
  );
}
