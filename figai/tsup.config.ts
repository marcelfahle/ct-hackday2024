import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'es2018',
  splitting: false,
  sourcemap: true,
  clean: true,
});

