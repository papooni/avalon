import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/branding';

export const alt = `${BRAND.productName}: a game of hidden loyalties for 5 to 10 players`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SEALS = ['#3E7C5A', '#9B2F3F', '#3E7C5A', '#2A3550', '#2A3550'];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          background: 'radial-gradient(circle at 50% 30%, #1B2740 0%, #0E1626 70%)',
          color: '#ECE4D3',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', gap: 28 }}>
          {SEALS.map((c, i) => (
            <div key={i} style={{ width: 96, height: 96, borderRadius: 48, background: c, border: '4px solid #F0D59A' }} />
          ))}
        </div>
        <div style={{ fontSize: 104, letterSpacing: 2 }}>{BRAND.productName}</div>
        <div style={{ fontSize: 40, color: '#D9B867', maxWidth: 960, textAlign: 'center' }}>
          Five quests. A table of friends. A few of them are lying.
        </div>
        <div style={{ fontSize: 30, color: '#ECE4D3', opacity: 0.7 }}>Free in your browser · 5 to 10 players · each on your own phone</div>
      </div>
    ),
    size,
  );
}
