'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomView } from '@/server/rooms';
import { EVENTS, type Ack, type GameCommandInput } from '@/server/protocol';
import { createSocket, request } from './socket';
import { clearSeat, loadSeat } from './session';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';
export type RoomError = { code: string; message: string } | null;

type CommandBody = GameCommandInput extends infer C ? (C extends { commandId: string; stepId: number } ? Omit<C, 'commandId' | 'stepId'> : never) : never;

/**
 * Owns the socket for the room screen: resumes the seat with the stored token,
 * keeps the latest per-viewer view, and sends commands with idempotency keys.
 * Commands that time out are retried with the SAME commandId, so a flaky
 * network can never double-vote.
 */
export function useRoom(code: string, slot = 'main') {
  const [view, setView] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [fatal, setFatal] = useState<RoomError>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const seat = loadSeat(code, slot);
    if (!seat) {
      setFatal({ code: 'NO_SEAT', message: 'You do not have a seat in this room yet.' });
      return;
    }
    const s = createSocket();
    socketRef.current = s;

    const resume = async () => {
      const r = await request<{ playerId: string }>(s, EVENTS.resume, { code, token: seat.token });
      if (r.ok) {
        setStatus('online');
        setFatal(null);
      } else if (r.code === 'SESSION_INVALID' || r.code === 'ROOM_NOT_FOUND') {
        clearSeat(code, slot);
        setFatal(r);
      }
    };

    s.on('connect', () => void resume());
    s.on('disconnect', () => setStatus('reconnecting'));
    s.io.on('reconnect_failed', () => setStatus('offline'));
    s.on(EVENTS.view, (v: RoomView) => {
      // Ignore out-of-order deliveries of older game states.
      setView((prev) => {
        if (prev?.game && v.game && prev.game.id === v.game.id && v.game.version < prev.game.version) return prev;
        return v;
      });
    });
    s.on(EVENTS.kicked, (p: { message: string }) => {
      clearSeat(code, slot);
      setFatal({ code: 'REMOVED', message: p.message });
    });

    const goOffline = () => setStatus((st) => (st === 'online' ? st : 'offline'));
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('offline', goOffline);
      s.removeAllListeners();
      s.disconnect();
    };
  }, [code, slot]);

  const send = useCallback(async <T,>(event: string, payload: unknown = {}): Promise<Ack<T>> => {
    const s = socketRef.current;
    if (!s) return { ok: false, code: 'OFFLINE', message: 'Not connected.' };
    return request<T>(s, event, payload);
  }, []);

  const command = useCallback(
    async (body: CommandBody): Promise<Ack> => {
      const stepId = view?.game?.stepId ?? 0;
      const payload = { ...body, commandId: crypto.randomUUID(), stepId };
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await send(EVENTS.command, payload);
        if (r.ok || r.code !== 'TIMEOUT') return r;
      }
      return { ok: false, code: 'TIMEOUT', message: 'Your action could not be confirmed. Check your connection.' };
    },
    [send, view?.game?.stepId],
  );

  return { view, status, fatal, send, command };
}
