# Architecture

```
 Browser (one per player)                 Node process (authoritative)
 ┌───────────────────────────┐   wss    ┌─────────────────────────────────────┐
 │ Next.js App Router UI     │ ───────▶ │ Socket.IO  (src/server/socket.ts)   │
 │  useRoom(): socket, view, │ ◀─────── │  Zod validation, rate limits        │
 │  idempotent commands      │  view    │            │                        │
 └───────────────────────────┘ per seat │ RoomManager (src/server/rooms.ts)   │
                                        │  lobby, sessions, timers, views     │
                                        │            │                        │
                                        │ Engine (src/engine, pure TS)        │
                                        │  validate → apply → nextState       │
                                        │  public / private projections       │
                                        │            │                        │
                                        │ Persistence (Prisma, encrypted)     │
                                        └────────────┼────────────────────────┘
                                                     ▼
                                                 PostgreSQL
```

## Layers

**1. Engine (`src/engine`).** Pure, deterministic TypeScript with no React, Node, network, clock or `Math.random` (enforced by ESLint). Randomness is injected (`Rng`). The state machine is explicit:

| Phase | Accepted commands | Leaves to |
| --- | --- | --- |
| LOBBY | START_GAME (system) | ROLE_REVEAL |
| ROLE_REVEAL | ACKNOWLEDGE, ADVANCE (system) | KNOWLEDGE_REVEAL |
| KNOWLEDGE_REVEAL | ACKNOWLEDGE, ADVANCE | TEAM_PROPOSAL |
| TEAM_PROPOSAL | DRAFT_TEAM, PROPOSE_TEAM (leader) | TEAM_VOTING |
| TEAM_VOTING | CAST_VOTE (each player once) | VOTE_REVEAL (when all voted) |
| VOTE_REVEAL | ACKNOWLEDGE, ADVANCE | QUEST_ACTION · TEAM_PROPOSAL · GAME_OVER |
| QUEST_ACTION | SUBMIT_QUEST_CARD (team, once) | QUEST_REVEAL (when all played) |
| QUEST_REVEAL | ACKNOWLEDGE, ADVANCE | ROUND_RESULT |
| ROUND_RESULT | ACKNOWLEDGE, ADVANCE | TEAM_PROPOSAL · ASSASSINATION · GAME_OVER |
| ASSASSINATION | ASSASSINATE (assassin) | GAME_OVER |
| GAME_OVER | none | — |

API, as required by the brief: `createGame`, `validateCommand(state, command, actor)`, `applyCommand(state, command, actor, rng)`, `determineNextState(state, rng)`, `getPublicGameState(state)`, `getPrivatePlayerState(state, playerId)`. `applyCommand` never mutates its input.

Out-of-order and late commands are rejected with a `stepId` that increments on every phase change; phase-bound commands must carry the `stepId` they were issued against. Idempotency uses `actor:commandId`, remembered in the state (bounded at 1000).

Roles are data (`roles.ts`). Knowledge comes from tags and sight rules (for example, Mordred simply lacks the `VISIBLE_TO_MERLIN` tag). A new role is a new entry; display text lives separately in `src/lib/branding.ts`.

**2. Authoritative server (`src/server/rooms.ts`).** Owns rooms, members, host rights, readiness, settings, chat and timers. It wraps the engine, and only the server issues `START_GAME` and `ADVANCE`. Reveal phases advance when every *connected* player has continued, or after a timeout (20, 25 and 15 seconds), so a disconnected phone never stalls the table. Votes and quest cards always wait for the specific player, because those are their decisions to make.

**3. Real-time layer (`src/server/socket.ts`).** Every inbound message is parsed with Zod (`protocol.ts`) and rate-limited per socket and per IP. Outbound views are built per viewer (`RoomManager.viewFor`) and emitted to that seat's private channel `seat:<code>:<playerId>`. The room channel never carries game state.

**4. Client (`src/app`, `src/components`, `src/client`).** `useRoom` resumes the seat with the stored token, keeps the newest view (an older `version` is ignored), and sends commands with a fresh `commandId`. On timeout it retries with the *same* id, so a retry can never double-vote. `src/lib/guide.ts` turns a view into the guided instructions (phase, what happened, whether you must act, what is next) and is unit-tested.

**5. Persistence (`src/server/persistence.ts`, `prisma/`).** The room, including the hidden game state, is stored as an AES-256-GCM encrypted snapshot for crash recovery. Normalised rows are written only once information is public: proposals and votes at reveal, rounds at resolution. `QuestSubmission` deliberately has no card column. Without `DATABASE_URL` the server runs in memory (demo mode).

**6. Reconnect and recovery.** Each seat has a 256-bit bearer token; only its SHA-256 hash is stored. On reconnect the token is matched in constant time, the socket joins the seat channel, and the next view restores exactly that player's public and private state. After a server restart rooms are restored from snapshots, with every player marked offline until they reconnect. A host offline for 60 seconds hands the host role to a connected player.

## Data model

Room, Player, PlayerSession, ReconnectToken, Game, GameConfiguration, RoleAssignment, Round, TeamProposal, Vote, QuestSubmission and GameEvent are defined in `prisma/schema.prisma`. The migration is in `prisma/migrations/0001_init`.

## Scaling note

The authoritative state lives in one Node process. Run a single instance, or several behind sticky sessions with rooms pinned to an instance. A Socket.IO Redis adapter alone is **not** sufficient for multiple instances, because RoomManager state would also need to be shared or partitioned by room.
