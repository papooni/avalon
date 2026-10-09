/**
 * Seeds nothing secret. The demo experience is provided by `npm run demo`,
 * which runs the server in memory and opens 5 seats in one browser window
 * (see src/app/demo). This seed only verifies connectivity.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
prisma
  .$queryRaw`SELECT 1`
  .then(() => console.log('Database reachable. No seed data is required.'))
  .finally(() => prisma.$disconnect());
