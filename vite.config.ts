import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Serves the Vercel functions in /api during `vite dev`, so `npm run dev` works
 * without the Vercel CLI. Handlers use the Web-standard `GET(request)` signature.
 */
function vercelApiDev(): Plugin {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));

      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost');
        const name = url.pathname.replace(/^\/api\//, '');
        // Mirror Vercel: one function per file, "_"-prefixed files are private.
        if (!/^[a-z][\w-]*$/i.test(name) || !existsSync(`api/${name}.ts`)) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined;
          if (!handler) return next();

          const response = await handler(new Request(url, { method: req.method }));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vercelApiDev()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
