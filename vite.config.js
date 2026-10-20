import { defineConfig } from 'vite';

// Proxies API calls made by the client to the Express high-score server
// (see `server/index.js`, started separately via `npm run server`) so the
// game can talk to `/api/scores` during `vite dev` without CORS issues.
export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    }
});
