// Must come first: loads the root .env before Prisma Client reads DATABASE_URL.
import { apiPort } from './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/_app.js';
import { createContext } from './trpc.js';

const server = Fastify({ logger: true });

async function main() {
  await server.register(cors, { origin: true });
  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });

  await server.listen({ port: apiPort, host: '0.0.0.0' });
}

main().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
