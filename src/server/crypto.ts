import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Rng } from '../engine';
import { CODE_ALPHABET, ROOM_CODE_LENGTH } from './roomCode';

export { ROOM_CODE_LENGTH, ROOM_CODE_PATTERN } from './roomCode';

/** Cryptographically secure RNG for role dealing, leader choice and card shuffles. */
export const cryptoRng: Rng = { int: (maxExclusive) => randomInt(maxExclusive) };

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** 256-bit bearer token for seat reconnection. Only its hash is stored. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(candidateToken: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(candidateToken), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newId(): string {
  return randomUUID();
}

/** AES-256-GCM for game snapshots at rest (they contain hidden roles). */
export function encryptJson(value: unknown, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('SNAPSHOT_ENCRYPTION_KEY must be 32 bytes hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decryptJson<T>(payload: string, keyHex: string): T {
  const [iv, tag, data] = payload.split('.');
  if (!iv || !tag || !data) throw new Error('Malformed snapshot');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}
