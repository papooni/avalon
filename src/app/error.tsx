'use client';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  // The error object is intentionally not rendered: it could contain internal details.
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl">Something broke on this screen</h1>
        <p className="text-parchment/75">Your seat is safe on the server. Reload to rejoin the table.</p>
        <Button onClick={reset}>Reload this screen</Button>
      </div>
    </main>
  );
}
