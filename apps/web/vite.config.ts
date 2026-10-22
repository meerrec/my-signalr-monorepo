import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
  // Worker с SignalR — module worker в dev и в build (иначе build отдаёт IIFE).
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    // Правило 8 AGENTS.md: хук Rolldown задействован, кастомных output-опций пока нет,
    // sourcemap задаётся на уровне build (rolldownOptions.output.sourcemap не поддерживается).
    rolldownOptions: {},
    sourcemap: true,
  },
});
