# Deployment

## Requirements
- Node 20.11+ (22 recommended) and PostgreSQL 14+.
- One long-running process. This is not a serverless app, because WebSockets keep state in the process. See "Scaling" below.

## Environment
See `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no (3000) | HTTP and WebSocket port |
| `ALLOWED_ORIGINS` | yes in production | Comma-separated origins allowed to open sockets, e.g. `https://avalon.example.com` |
| `DATABASE_URL` | for persistence | Postgres URL; when unset the server runs in memory |
| `SNAPSHOT_ENCRYPTION_KEY` | with a database | 64 hex characters (32 bytes) |
| `LOG_LEVEL` | no | `info` by default |

## Docker Compose
```bash
export SNAPSHOT_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
docker compose up --build
```
The container runs `prisma migrate deploy` and then starts the server. Its health check is `GET /api/health`.

## Any container host (Fly.io, Render, Railway, ECS, Kubernetes)
1. Build the image from `Dockerfile`.
2. Provide the environment variables above, with `ALLOWED_ORIGINS` set to your public origin.
3. Terminate TLS at the proxy and forward WebSocket upgrades on path `/ws`.
4. Set proxy idle timeouts above 60 seconds; Socket.IO pings every 25 seconds.
5. Run **one instance**, or several with sticky sessions *and* rooms pinned to instances.

## Scaling
The RoomManager keeps authoritative room state in memory and writes encrypted snapshots to Postgres. To run more than one instance you need either:
- a router that sends every connection for room `X` to the same instance (for example, consistent hashing on the code in the URL), or
- moving room state into a shared store with per-room locking.

Adding the Socket.IO Redis adapter alone is not enough.

## Operations
- Logs are JSON lines on stdout and redacted by design. Never set up request-body logging at the proxy for `/ws`.
- Back up Postgres as usual. Rotating `SNAPSHOT_ENCRYPTION_KEY` makes in-flight room snapshots unreadable; restored rooms are skipped with a warning, so rotate between sessions.
- Rooms expire after 6 hours idle with nobody connected.
