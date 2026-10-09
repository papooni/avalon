'use client';
import { io, type Socket } from 'socket.io-client';
import type { Ack } from '@/server/protocol';

export function createSocket(): Socket {
  return io({ path: '/ws', transports: ['websocket', 'polling'], autoConnect: true, reconnectionDelayMax: 4000 });
}

/** Emits with an acknowledgement and a timeout. */
export function request<T = unknown>(socket: Socket, event: string, payload: unknown, timeoutMs = 6000): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack<T>) => {
      if (err) resolve({ ok: false, code: 'TIMEOUT', message: 'The server did not answer. Check your connection.' });
      else resolve(res);
    });
  });
}

/** One-shot connection for create/join flows before the room screen mounts. */
export async function oneShot<T>(event: string, payload: unknown): Promise<Ack<T>> {
  const s = createSocket();
  try {
    await new Promise<void>((resolve, reject) => {
      if (s.connected) return resolve();
      s.once('connect', () => resolve());
      s.once('connect_error', () => reject(new Error('connect')));
    });
    return await request<T>(s, event, payload);
  } catch {
    return { ok: false, code: 'OFFLINE', message: 'Could not reach the server. Check your connection and try again.' };
  } finally {
    s.disconnect();
  }
}
