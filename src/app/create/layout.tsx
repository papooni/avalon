import type { Metadata } from 'next';

const description = 'Host a free game of Avalon Night for 5 to 10 players. Create a room, share the code, and everyone joins on their own phone.';

export const metadata: Metadata = {
  title: 'Create a room',
  description,
  alternates: { canonical: '/create' },
  openGraph: { title: 'Create a room', description, url: '/create' },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
