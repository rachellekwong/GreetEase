import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Must match the API server (default 3030 in server/index.mjs)
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3030';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  logLevel: 'info',
  plugins: [react()],
  server: {
    host: true,
    // Prefer 5299; if busy Vite picks the next free port (check terminal for the real URL)
    port: 5299,
    strictPort: false,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4299,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
