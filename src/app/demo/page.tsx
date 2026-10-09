'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveSeat } from '@/client/session';
import { oneShot } from '@/client/socket';

type Seat = { code: string; playerId: string; token: string };
const NAMES = ['Ysolde', 'Bram', 'Corin', 'Dagny', 'Elric', 'Fenna', 'Gawen', 'Hild', 'Ivo', 'Jessamy'];

/**
 * Demo mode: one browser window plays every seat. Useful for trying the flow
 * alone or for presentations. Each frame stores its token under its own slot.
 */
export default function DemoPage() {
  const [count, setCount] = useState(5);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    const host = await oneShot<Seat>('room:create', { name: NAMES[0], avatar: 'oak' });
    if (!host.ok) return setError(host.message);
    const roomCode = host.data!.code;
    saveSeat(roomCode, host.data!, 'demo1');
    for (let i = 1; i < count; i++) {
      const r = await oneShot<Seat>('room:join', { code: roomCode, name: NAMES[i] });
      if (!r.ok) return setError(r.message);
      saveSeat(roomCode, r.data!, `demo${i + 1}`);
    }
    setCode(roomCode);
  };

  if (!code) {
    return (
      <main id="main" className="mx-auto max-w-md space-y-5 px-5 py-12">
        <h1 className="text-4xl">Demo table</h1>
        <p className="text-parchment/80">Opens a whole table in one window, one panel per seat. In a real game every player uses their own device.</p>
        <label className="block space-y-2">
          <span className="font-medium">Players</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-12 w-full rounded-md border border-night-line bg-night-deep px-3">
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="text-treason-soft">{error}</p>}
        <Button size="lg" className="w-full" onClick={start}>
          Open demo table
        </Button>
      </main>
    );
  }

  return (
    <main id="main" className="grid gap-2 p-2 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <iframe key={i} title={`Seat ${i + 1}: ${NAMES[i]}`} src={`/room/${code}?seat=demo${i + 1}`} className="h-[85dvh] w-full rounded-lg border border-night-line" />
      ))}
    </main>
  );
}
