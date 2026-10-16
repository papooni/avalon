import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demo table',
  alternates: { canonical: '/demo' },
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
