'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NameForm } from '@/components/game/NameForm';
import { saveSeat } from '@/client/session';
import { oneShot } from '@/client/socket';

export default function CreatePage() {
  const router = useRouter();
  return (
    <main id="main" className="mx-auto max-w-md space-y-6 px-5 py-10">
      <Link href="/" className="text-sm text-gilt underline-offset-4 hover:underline">
        Back
      </Link>
      <h1 className="text-4xl">Create a room</h1>
      <p className="text-parchment/75">You will host the game. Once you are in, share the code with the table.</p>
      <NameForm
        submitLabel="Create room"
        onSubmit={async ({ name, avatar }) => {
          const r = await oneShot<{ code: string; playerId: string; token: string }>('room:create', { name, avatar });
          if (!r.ok) return r.message;
          saveSeat(r.data!.code, { playerId: r.data!.playerId, token: r.data!.token });
          router.push(`/room/${r.data!.code}`);
          return null;
        }}
      />
    </main>
  );
}
