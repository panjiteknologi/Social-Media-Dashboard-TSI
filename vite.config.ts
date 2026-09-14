import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The API is its own process in development. Proxying it keeps the session
    // cookie same-origin, exactly as in production where one server serves both.
    proxy: { '/api': 'http://localhost:8787' },
    // Only the web app's sources need watching. The Postgres data directory and
    // the credentials folder change underneath the watcher, and Windows can hold
    // those files locked, which crashes it. Server code has its own watcher.
    watch: { ignored: ['**/.data/**', '**/secrets/**', '**/server/**', '**/dist-server/**'] },
  },
});
