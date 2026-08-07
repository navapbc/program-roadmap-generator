import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Loads configuration from the single `.env` file at the repository root.
 *
 * This module must be imported before anything that reads configuration —
 * notably Prisma Client, which reads `DATABASE_URL` when it is constructed.
 * Import it first in any entry point (see `src/index.ts`, `prisma/seed.ts`).
 *
 * `override: true` makes the file the authoritative source, so values in
 * `.env` win over anything already present in the shell environment.
 */
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

dotenv.config({ path: `${repoRoot}.env`, override: true });

/** Port the API listens on. Set `API_PORT` in the root `.env` to change it. */
export const apiPort = Number(process.env.API_PORT ?? 4000);

if (!Number.isInteger(apiPort) || apiPort <= 0 || apiPort > 65535) {
  throw new Error(
    `Invalid API_PORT: ${process.env.API_PORT}. Set API_PORT in .env to a port between 1 and 65535.`,
  );
}
