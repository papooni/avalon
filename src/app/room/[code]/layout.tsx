import type { Metadata } from 'next';

// Rooms are private and short-lived: never index them, even if a code link leaks.
export const metadata: Metadata = {
  title: 'Game room',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
