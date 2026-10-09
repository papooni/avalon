/**
 * Structured logger with mandatory redaction.
 *
 * Hidden information must never reach logs. Rather than trusting every call
 * site, the logger drops any key that could carry secrets, at any depth.
 */
const SECRET_KEYS = new Set([
  'roles', 'role', 'roleId', 'finalRoles', 'knowledge', 'pendingVotes', 'pendingQuestCards',
  'approve', 'card', 'token', 'tokenHash', 'sessionToken', 'reconnectToken', 'authorization',
  'cookie', 'snapshot', 'state', 'me', 'private', 'votes', 'targetId',
]);

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    if (value instanceof Error) return { name: value.name, message: redactMessage(value.message) };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.has(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  if (typeof value === 'string') return redactMessage(value);
  return value;
}

const ROLE_WORDS = /\b(MERLIN|PERCIVAL|ASSASSIN|MORGANA|MORDRED|OBERON|MINION|LOYAL_SERVANT)\b/g;
function redactMessage(msg: string): string {
  return msg.replace(ROLE_WORDS, '[role]').replace(/[A-Za-z0-9_-]{40,}/g, '[token]');
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Level[] = ['debug', 'info', 'warn', 'error'];
const threshold = LEVELS.indexOf((process.env.LOG_LEVEL as Level) ?? 'info');

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS.indexOf(level) < threshold) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg: redactMessage(msg), ...(redact(fields ?? {}) as object) });
  (level === 'error' ? console.error : console.log)(line);
}

export const log = {
  debug: (m: string, f?: Record<string, unknown>) => emit('debug', m, f),
  info: (m: string, f?: Record<string, unknown>) => emit('info', m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => emit('error', m, f),
};
