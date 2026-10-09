/**
 * Input sanitisation. React escapes output, so this is defence in depth:
 * normalise Unicode, strip control / zero-width / bidi-override characters,
 * collapse whitespace and enforce lengths.
 */
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const ANGLE = /[<>]/g;

export const NAME_MAX = 20;
export const CHAT_MAX = 280;

export type SanitizeResult = { ok: true; value: string } | { ok: false; message: string };

export function sanitizeName(raw: string): SanitizeResult {
  const value = raw.normalize('NFKC').replace(INVISIBLE, '').replace(ANGLE, '').replace(/\s+/g, ' ').trim();
  if (value.length < 1) return { ok: false, message: 'Enter a name so others can recognise you.' };
  if ([...value].length > NAME_MAX) return { ok: false, message: `Names can be up to ${NAME_MAX} characters.` };
  return { ok: true, value };
}

export function sanitizeChat(raw: string): SanitizeResult {
  const value = raw.normalize('NFKC').replace(INVISIBLE, '').replace(/[ \t]+/g, ' ').trim();
  if (!value) return { ok: false, message: 'Type a message first.' };
  if ([...value].length > CHAT_MAX) return { ok: false, message: `Messages can be up to ${CHAT_MAX} characters.` };
  return { ok: true, value };
}
