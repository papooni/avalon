/**
 * Seat tokens are stored per room (and per demo "slot", so one browser can
 * hold several seats in demo mode). Tokens identify a seat; they never contain
 * or unlock roles on the client. Nothing secret about the game is persisted.
 */
export interface SeatCredentials {
  playerId: string;
  token: string;
}

const key = (code: string, slot: string) => `avalon.seat.${code}.${slot}`;

export function loadSeat(code: string, slot = 'main'): SeatCredentials | null {
  try {
    const raw = localStorage.getItem(key(code, slot));
    return raw ? (JSON.parse(raw) as SeatCredentials) : null;
  } catch {
    return null;
  }
}

export function saveSeat(code: string, creds: SeatCredentials, slot = 'main') {
  try {
    localStorage.setItem(key(code, slot), JSON.stringify(creds));
  } catch {
    /* storage unavailable: the seat lasts for this tab only */
  }
}

export function clearSeat(code: string, slot = 'main') {
  try {
    localStorage.removeItem(key(code, slot));
  } catch {
    /* ignore */
  }
}

export function loadProfile(): { name: string; avatar: string } | null {
  try {
    const raw = localStorage.getItem('avalon.profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: { name: string; avatar: string }) {
  try {
    localStorage.setItem('avalon.profile', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
