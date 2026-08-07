import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration lives in a single .env file at the repository root.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  // Third arg '' loads all keys, not just VITE_-prefixed ones. These values
  // are build/dev-server config only and are never exposed to the browser.
  const env = loadEnv(mode, repoRoot, '');

  // `||` rather than `??` so blank or unparseable values fall back to defaults.
  const webPort = Number(env.WEB_PORT) || 5173;
  const apiPort = Number(env.API_PORT) || 4000;

  return {
    plugins: [react()],
    server: {
      port: webPort,
      proxy: {
        '/trpc': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
