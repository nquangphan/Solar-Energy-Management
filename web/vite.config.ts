import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev: the web calls same-origin `/api/...`; the backend has no global prefix,
    // so strip `/api` on the way through. No CORS needed in dev.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Bật xử lý CSS: guard class đọc stylesheet qua `?raw`; tắt thì Vitest trả chuỗi rỗng.
    css: true,
  },
});
