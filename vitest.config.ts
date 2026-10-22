import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  test: {
    include: [
      'apps/web/src/**/*.test.{ts,tsx}',
      'packages/*/src/**/*.test.ts',
    ],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
});
