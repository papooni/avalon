import type { Metadata } from 'next';

const description = 'Got a room code? Join your friends in a game of Avalon Night right in your browser. No download or account needed.';

export const metadata: Metadata = {
  title: 'Join a room',
  description,
  alternates: { canonical: '/join' },
  openGraph: { title: 'Join a room', description, url: '/join' },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
