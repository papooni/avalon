'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NameForm } from '@/components/game/NameForm';
import { saveSeat } from '@/client/session';
import { oneShot } from '@/client/socket';

function JoinForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  return (
    <NameForm
      submitLabel="Join room"
      onSubmit={async ({ name, avatar }) => {
        const clean = code.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(clean)) return 'Room codes are 6 letters and numbers.';
        const r = await oneShot<{ code: string; playerId: string; token: string }>('room:join', { code: clean, name, avatar });
        if (!r.ok) return r.message;
        saveSeat(r.data!.code, { playerId: r.data!.playerId, token: r.data!.token });
        router.push(`/room/${r.data!.code}`);
        return null;
      }}
    >
      <div className="space-y-2">
        <label htmlFor="code" className="block font-medium">
          Room code
        </label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="font-display text-2xl tracking-[0.2em]"
          data-testid="code-input"
        />
      </div>
    </NameForm>
  );
}

export default function JoinPage() {
  return (
    <main id="main" className="mx-auto max-w-md space-y-6 px-5 py-10">
      <Link href="/" className="text-sm text-gilt underline-offset-4 hover:underline">
        Back
      </Link>
      <h1 className="text-4xl">Join a room</h1>
      <Suspense>
        <JoinForm />
      </Suspense>
    </main>
  );
}
