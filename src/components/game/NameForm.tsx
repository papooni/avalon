'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadProfile, saveProfile } from '@/client/session';
import { cn } from '@/lib/utils';
import { AVATAR_IDS, AvatarGlyph } from './Art';

export function NameForm({
  submitLabel,
  onSubmit,
  children,
}: {
  submitLabel: string;
  onSubmit: (p: { name: string; avatar: string }) => Promise<string | null>;
  children?: React.ReactNode;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_IDS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setName(p.name);
      if (AVATAR_IDS.includes(p.avatar)) setAvatar(p.avatar);
    }
  }, []);

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError('Enter a name so others can recognise you.');
        setBusy(true);
        saveProfile({ name: name.trim(), avatar });
        const err = await onSubmit({ name: name.trim(), avatar });
        setBusy(false);
        setError(err);
      }}
    >
      {children}
      <div className="space-y-2">
        <label htmlFor="name" className="block font-medium">
          Your name
        </label>
        <Input
          id="name"
          autoComplete="nickname"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'form-error' : 'name-hint'}
          data-testid="name-input"
        />
        <p id="name-hint" className="text-sm text-parchment/60">
          Up to 20 characters. Use the name your friends know you by.
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 font-medium">Pick an emblem (optional)</legend>
        <div className="grid grid-cols-6 gap-2" role="radiogroup">
          {AVATAR_IDS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avatar === a}
              aria-label={a}
              onClick={() => setAvatar(a)}
              className={cn('grid place-items-center rounded-md p-1', avatar === a ? 'bg-gilt/15 ring-2 ring-gilt' : 'hover:bg-white/5')}
            >
              <AvatarGlyph avatar={a} />
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p id="form-error" role="alert" className="text-treason-soft">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy} data-testid="submit">
        {busy ? 'One moment…' : submitLabel}
      </Button>
    </form>
  );
}
