import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// React shell (Table Editor / SQL Studio) di-build ke dist/ dan dimuat oleh
// Electron. Platform AVA TIDAK lagi disajikan lewat middleware Vite —
// sekarang disajikan server statis di main.ts (127.0.0.1:5174) dan dibuka via
// iframe absolut, sehingga jalan sama persis di dev maupun di build .exe.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
