import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@roadmap/server';

export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>();
