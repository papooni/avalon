import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { RoomClient } from '@/components/game/RoomClient';

export const dynamic = 'force-dynamic';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) notFound();
  return (
    <Suspense>
      <RoomClient code={clean} />
    </Suspense>
  );
}
