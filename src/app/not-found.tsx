import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl">Nothing here</h1>
        <p className="text-parchment/75">That page or room code does not exist. Check the code with your host.</p>
        <Button asChild>
          <Link href="/join">Enter a room code</Link>
        </Button>
      </div>
    </main>
  );
}
