import { defineConfig } from 'vitest/config';

/**
 * Pruebas rapidas: las que se corren en cada cambio. Segundos, no minutos.
 *
 * Las pruebas de escenario y de IA simulan partidas enteras —hasta
 * veinticuatro minutos de juego cada una— y quedan fuera a proposito: en el
 * runner de integracion pasaron el paso de siete minutos, frente al minuto
 * escaso de todo lo demas. Van en `vitest.lento.config.ts` y en su propio
 * trabajo, en paralelo.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.lento.test.ts', 'node_modules/**'],
  },
});
