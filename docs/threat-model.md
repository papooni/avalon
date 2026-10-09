# Threat model: hidden-information leakage

## Assets
1. Role assignments, and the knowledge derived from them.
2. Votes before they are revealed.
3. Which player played which quest card. This is never meant to be known, even after the game.
4. Seat tokens, which grant someone's identity at the table.
5. Host privileges.

## Adversaries
- **A curious player** using browser devtools, reading WebSocket frames, local storage or the HTML.
- **A shoulder-surfer** at the same physical table.
- **A malicious client** sending forged, replayed or out-of-order messages.
- **An outsider** guessing room codes or tokens, or attempting cross-site requests.
- **An operator or log reader** with access to logs or database rows.

## Leakage channels and mitigations

| Channel | Mitigation | Verified by |
| --- | --- | --- |
| WebSocket payloads | Views are built per viewer (`viewFor`) from `getPublicGameState` plus that viewer's `getPrivatePlayerState`, and sent only to the seat's private channel. The full `GameState` is never serialised to a client. | projections.test, rooms.test "each view…", e2e #10 |
| Public projection | Contains no roles (except the opt-in end reveal), no `pendingVotes`, and no quest-card authors. During voting it lists *who* has voted, never how. During a quest it gives a count only. | projections.test |
| Quest-card authorship | The author→card map is deleted as soon as the quest resolves; only shuffled cards and totals remain. The database has no card column per player. | engine.test "authors dropped" |
| Spectators | `getPrivatePlayerState` throws for non-seated players; spectators receive public state only. | projections.test |
| Reconnection | The seat is restored only by a token whose hash matches, compared in constant time. The view after resume is identical in scope to the original view. | rooms.test "reconnection", e2e #10 |
| Browser storage | Only the seat token and a name/avatar profile are stored. Roles live in memory only, and on screen only while the reveal is held. | code review; `client/session.ts` |
| DOM and HTML | The role and knowledge content is *mounted* only while held, not merely blurred. Pages are client-rendered from the socket, so no game state appears in server HTML. | `PrivateReveal.tsx`, e2e helper `holdAndRead` |
| Shoulder-surfing | Privacy warning first, press-and-hold, hide on release, on window blur and on tab hide, and confirmation before skipping. | `PrivateReveal.tsx` |
| Logs | The logger drops secret keys at any depth (`roles`, `card`, `approve`, `token`, `state` …), masks role names and long tokens in messages, and redacts exception messages. Commands log only type and outcome. | rooms.test "logger redacts" |
| Database at rest | The hidden state lives only in an encrypted snapshot. RoleAssignment rows are written at start for recaps; restrict database access accordingly or drop that table if not needed. | `persistence.ts` |
| Timing and metadata | Vote progress shows who has voted, which the physical game also shows. Quest progress is a count only, so it does not reveal who is still deciding. | design choice |

## Integrity threats

| Threat | Mitigation |
| --- | --- |
| Role spoofing or acting for others | The actor comes from the socket binding (set by create, join or resume), never from the payload. |
| Forged or malformed messages | Zod schemas, a 16 KB message limit, strict settings schema. |
| Replay or duplicates | `commandId` idempotency per actor, plus a `stepId` that rejects stale or late commands. |
| Out-of-phase actions | `COMMANDS_BY_PHASE` whitelist, with per-command authorisation (leader, team member, assassin). |
| Good playing Fail | Checked server-side from the role (`canFail`). The UI also hides the button. |
| Host-only actions | `requireHost` on settings, start, remove, transfer and rematch. |
| Brute-forcing room codes | 31^6 ≈ 887M codes, join rate limit per IP, and rooms expire after 6h idle. |
| Token theft | 256-bit random tokens, only hashes stored, revoked when a player is removed. Use HTTPS/WSS in production. |
| XSS | React escaping, input sanitisation (control, zero-width and bidi characters stripped, `<>` removed from names), strict CSP, no `dangerouslySetInnerHTML`. |
| CSRF / cross-site WebSocket hijacking | The Socket.IO `allowRequest` origin allowlist. Auth tokens travel in message payloads, not cookies, so the browser cannot be tricked into sending them. |
| Denial of service | Token-bucket limits on events, joins and chat; payload size caps; bounded chat history and idempotency memory. |
| Bad randomness | `crypto.randomInt` for dealing, first leader, seat order and shuffles. Engine tests use a seeded RNG only. |

## Residual risks
- A player can photograph their own screen. That is out of scope; the same is true of physical cards.
- Players at one table could collude by sharing their screens. This is social, not technical.
- With `revealRolesAtEnd`, roles are sent to everyone at `GAME_OVER`. This is intentional and can be switched off.
- Operators with the snapshot key can read hidden state for live games. Rotate the key and restrict access.
