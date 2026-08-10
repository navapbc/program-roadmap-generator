// Must come first: loads the root .env before Prisma Client reads DATABASE_URL.
import { apiPort } from './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/_app.js';
import { createContext } from './trpc.js';

// trpc's fastify adapter matches batched requests on a single dynamic path
// segment containing every procedure name joined by commas (e.g.
// "/trpc/foo.bar,foo.bar,baz.qux"). find-my-way's default maxParamLength of
// 100 chars silently 404s the whole batch once enough procedures are
// batched together — easy to hit whenever several components mount at once
// (e.g. loading a saved view with multiple scopes).
const server = Fastify({ logger: true, maxParamLength: 5000 });

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
