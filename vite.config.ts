import { defineConfig } from 'vite';

// Relative base so the build works at any GitHub Pages path (/<repo>/).
export default defineConfig({
  base: './',
  // `npm run dev` talks to the Go server (see server/); run it with `docker compose up` or `go run ./cmd/sachet`.
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
