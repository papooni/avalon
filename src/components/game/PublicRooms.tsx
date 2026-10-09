'use client';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSocket, request } from '@/client/socket';
import type { ListedRoom } from '@/server/rooms';

const REFRESH_MS = 5000;

/** Open lobbies whose host chose to list them. Refreshes while the tab is visible. */
export function PublicRooms() {
  const [rooms, setRooms] = useState<ListedRoom[] | null>(null);

  useEffect(() => {
    const socket = createSocket();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const load = async () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible' && socket.connected) {
        const r = await request<ListedRoom[]>(socket, 'rooms:list', {});
        if (!stopped && r.ok) setRooms(r.data ?? []);
      }
      if (!stopped) timer = setTimeout(load, REFRESH_MS);
    };
    socket.on('connect', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', load);
      socket.disconnect();
    };
  }, []);

  if (!rooms || rooms.length === 0) return null;

  return (
    <section aria-labelledby="open-rooms-h" className="glass mx-auto w-full max-w-sm p-4" data-testid="public-rooms">
      <h2 id="open-rooms-h" className="mb-2 text-xl">
        Open tables
      </h2>
      <ul className="divide-y divide-white/[0.05]">
        {rooms.map((r) => (
          <li key={r.code} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.hostName}’s table</span>
              <span className="flex items-center gap-1 text-sm text-parchment/60">
                <Users className="size-3.5" aria-hidden /> {r.players}/{r.maxPlayers} players
              </span>
            </span>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/join?code=${r.code}`} aria-label={`Join ${r.hostName}’s table`}>
                Join
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
