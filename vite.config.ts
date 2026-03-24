import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite 8 natively supports tsconfig paths
  resolve: {
    tsconfigPaths: true,
  },
  // Tauri expects a fixed port
  server: {
    port: 5173,
    strictPort: true,
    // Vite 8 feature: forwards browser logs to the terminal
    forwardConsole: true,
  },
  build: {
    // Vite 8 uses Rolldown (Rust) by default for builds
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
