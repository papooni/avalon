import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** PNG version of favicon.svg for iOS home screens and search results. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0E1626' }}>
        <svg width="150" height="150" viewBox="0 0 64 64">
          <path
            d="M32 4c4 0 5 3 8 4s6-1 9 2 0 6 2 9 5 4 5 8-3 5-4 8 1 6-2 9-6 0-9 2-4 5-8 5-5-3-8-4-6 1-9-2 0-6-2-9-5-4-5-8 3-5 4-8-1-6 2-9 6 0 9-2 4-5 8-5Z"
            fill="#9B2F3F"
            stroke="#F0D59A"
            strokeWidth="2"
          />
          <path d="M32 18l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" fill="#ECE4D3" />
        </svg>
      </div>
    ),
    size,
  );
}
