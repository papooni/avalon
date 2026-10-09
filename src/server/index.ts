import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { cryptoRng } from './crypto';
import { log } from './logger';
import { MemoryPersistence, PrismaPersistence, type Persistence } from './persistence';
import { RoomManager } from './rooms';
import { attachSocketServer } from './socket';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? `http://localhost:${port}`).split(',').map((s) => s.trim());

async function main() {
  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  let persistence: Persistence = new MemoryPersistence();
  if (process.env.DATABASE_URL) {
    const key = process.env.SNAPSHOT_ENCRYPTION_KEY;
    if (!key || key.length !== 64) throw new Error('SNAPSHOT_ENCRYPTION_KEY (64 hex chars) is required when DATABASE_URL is set');
    persistence = new PrismaPersistence(new PrismaClient(), key);
  } else {
    log.warn('DATABASE_URL not set: running in memory-only demo mode. Rooms are lost on restart.');
  }

  let pushViews: (code: string) => Promise<void> = async () => {};
  const rooms = new RoomManager({
    rng: cryptoRng,
    onChange: ({ code, events }) => {
      const room = rooms.getRoom(code);
      if (room) persistence.saveRoom(room, events);
      else persistence.deleteRoom(code);
      void pushViews(code);
    },
  });
  rooms.restore(await persistence.loadRooms());

  const httpServer = createServer((req, res) => void handle(req, res));
  const io = new Server(httpServer, {
    path: '/ws',
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
    cors: { origin: allowedOrigins, credentials: false },
    // CSRF / cross-site WebSocket hijacking defence: only our own origins may connect.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || allowedOrigins.includes(origin));
    },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
  });
  ({ pushViews } = attachSocketServer(io, rooms));

  setInterval(() => rooms.tick(), 1000).unref();

  httpServer.listen(port, () => log.info(`Ready on http://localhost:${port}`));

  const shutdown = () => {
    log.info('Shutting down');
    io.close();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  log.error('Fatal startup error', { error: e });
  process.exit(1);
});
