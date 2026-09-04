import { defineConfig } from 'vitest/config';

/** Pruebas largas: simulan partidas completas. Ver `vitest.config.ts`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.lento.test.ts'],
    testTimeout: 240_000,
  },
});
