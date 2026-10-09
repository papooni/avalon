/**
 * Original vector art. Simple heraldic-style line glyphs drawn for this project.
 * No assets from any published edition are used.
 */
import type { RoleId } from '@/engine';
import { cn } from '@/lib/utils';

const AVATAR_PATHS: Record<string, React.ReactNode> = {
  oak: <path d="M12 3c-3 0-5 2-5 4.5-2 .5-3 2-3 3.8C4 13.7 6 15 8 15h3v6h2v-6h3c2 0 4-1.3 4-3.7 0-1.8-1-3.3-3-3.8C17 5 15 3 12 3Z" />,
  raven: <path d="M4 14c2-1 3-4 6-6 2-1.5 5-2 7-1l3-1-1 3c0 4-3 7-7 8l-2 3-1-3-5-3Z" />,
  lantern: <path d="M9 3h6v2l2 2v9l-2 3H9l-2-3V7l2-2V3Zm3 6c-1 1.5-1.5 2.5-1.5 3.5a1.5 1.5 0 0 0 3 0c0-1-.5-2-1.5-3.5Z" />,
  stag: <path d="M6 3l1 3 2 1-1-3 2 2v3h4V6l2-2-1 3 2-1 1-3 1 4-3 3v3l-2 5h-6l-2-5v-3L5 7l1-4Z" />,
  rose: <path d="M12 4c3 0 5 2 5 5s-2 5-5 5-5-2-5-5 2-5 5-5Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-1 7h2v7h-2zM8 17c1.5 0 3 1 3 2-1.5 0-3-.5-3-2Zm8 0c0 1.5-1.5 2-3 2 0-1 1.5-2 3-2Z" />,
  moon: <path d="M15 3a8 8 0 1 0 6 13A7 7 0 0 1 15 3Z" />,
  tower: <path d="M7 3h2v2h2V3h2v2h2V3h2v5l-1 1v12H8V9L7 8V3Zm4 9v3h2v-3h-2Z" />,
  fox: <path d="M4 4l5 4h6l5-4-1 8-3 4-4 4-4-4-3-4-1-8Zm5 8a1 1 0 1 0 0 .01Zm6 0a1 1 0 1 0 0 .01Z" />,
  key: <path d="M8 3a5 5 0 0 1 2 9.6V21h-2v-2H6v-2h2v-1H6v-2h2v-1.4A5 5 0 0 1 8 3Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  anvil: <path d="M3 7h14c0 2 2 3 4 3v2h-6l-1 2 2 3v2H8v-2l2-3-1-2H5C4 12 3 10 3 7Z" />,
  owl: <path d="M6 4l3 2h6l3-2v8c0 4-3 8-6 8s-6-4-6-8V4Zm3 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  sail: <path d="M11 3v12H5L11 3Zm2 2 7 10h-7V5ZM3 17h18l-2 4H5l-2-4Z" />,
};

export const AVATAR_IDS = Object.keys(AVATAR_PATHS);

export function AvatarGlyph({ avatar, className, label }: { avatar: string; className?: string; label?: string }) {
  return (
    <span className={cn('grid size-11 shrink-0 place-items-center rounded-full border border-gilt/30 bg-night-deep text-gilt', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="currentColor">
        {AVATAR_PATHS[avatar] ?? AVATAR_PATHS.oak}
      </svg>
    </span>
  );
}

/** Role emblems. Alignment is also expressed through the frame shape, not colour alone. */
const SIGILS: Record<RoleId, React.ReactNode> = {
  MERLIN: (
    <g>
      <path d="M32 10l4 12h12l-10 7 4 12-10-8-10 8 4-12-10-7h12z" />
      <circle cx="32" cy="30" r="3" fill="var(--sigil-bg)" />
    </g>
  ),
  PERCIVAL: <path d="M30 12h4v18h10v4H34v18h-4V34H20v-4h10z" />,
  LOYAL_SERVANT: <path d="M20 16h24v14c0 9-6 15-12 18-6-3-12-9-12-18V16Zm6 6v8c0 5 3 9 6 11 3-2 6-6 6-11v-8H26Z" />,
  ASSASSIN: <path d="M32 8l4 26h-3v8h5v4h-5v8h-2v-8h-5v-4h5v-8h-3z" />,
  MINION: <path d="M18 18l14 6 14-6-4 20-10 10-10-10z" />,
  MORGANA: (
    <g>
      <path d="M32 10l4 12h12l-10 7 4 12-10-8-10 8 4-12-10-7h12z" opacity="0.55" />
      <path d="M38 16a14 14 0 1 0 6 20 11 11 0 0 1-6-20Z" />
    </g>
  ),
  MORDRED: <path d="M16 20l8 6 8-12 8 12 8-6-4 22H20zM22 46h20v4H22z" />,
  OBERON: <path d="M32 10c8 6 12 14 12 22s-5 14-12 18c-7-4-12-10-12-18s4-16 12-22Zm0 10c-3 3-5 7-5 12s2 8 5 10c3-2 5-5 5-10s-2-9-5-12Z" />,
};

export function RoleSigil({ roleId, alignment, className }: { roleId: RoleId; alignment: 'GOOD' | 'EVIL'; className?: string }) {
  const good = alignment === 'GOOD';
  return (
    <svg viewBox="0 0 64 64" className={cn('size-24', className)} aria-hidden style={{ ['--sigil-bg' as string]: good ? '#24427A' : '#5E1A26' }}>
      {good ? (
        <circle cx="32" cy="32" r="29" fill="#24427A" stroke="#9DBBF0" strokeWidth="1.5" />
      ) : (
        <path d="M32 3 61 32 32 61 3 32Z" fill="#5E1A26" stroke="#E58A96" strokeWidth="1.5" />
      )}
      <g fill={good ? '#ECE4D3' : '#F3D1D6'}>{SIGILS[roleId] ?? SIGILS.LOYAL_SERVANT}</g>
    </svg>
  );
}

/** The wax seal used on the quest track. */
export function QuestSeal({
  state,
  size,
  failsRequired,
  current,
}: {
  state: 'pending' | 'success' | 'fail';
  size: number;
  failsRequired: number;
  current: boolean;
}) {
  const fill = state === 'success' ? '#3D6BBF' : state === 'fail' ? '#9B2F3F' : '#1B2742';
  const stroke = current ? '#F0D59A' : state === 'pending' ? '#3A4A6E' : 'rgba(255,255,255,0.25)';
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
      <path
        d="M32 4c4 0 5 3 8 4s6-1 9 2 0 6 2 9 5 4 5 8-3 5-4 8 1 6-2 9-6 0-9 2-4 5-8 5-5-3-8-4-6 1-9-2 0-6-2-9-5-4-5-8 3-5 4-8-1-6 2-9 6 0 9-2 4-5 8-5Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={current ? 2.5 : 1.5}
      />
      <circle cx="32" cy="32" r="17" fill="none" stroke="rgba(255,255,255,0.18)" />
      {state === 'pending' && (
        <text x="32" y="38" textAnchor="middle" fontSize="18" fill="#ECE4D3" fontFamily="var(--font-display)">
          {size}
        </text>
      )}
      {state === 'success' && <path d="M23 33l6 6 12-14" fill="none" stroke="#ECE4D3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      {state === 'fail' && <path d="M24 24l16 16M40 24 24 40" stroke="#F3D1D6" strokeWidth="4" strokeLinecap="round" />}
      {failsRequired > 1 && state === 'pending' && <circle cx="50" cy="14" r="7" fill="#9B2F3F" stroke="#ECE4D3" strokeWidth="1" />}
      {failsRequired > 1 && state === 'pending' && (
        <text x="50" y="17.5" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">
          2
        </text>
      )}
    </svg>
  );
}
