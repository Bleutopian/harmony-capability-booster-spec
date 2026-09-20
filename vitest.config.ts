import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: Object.fromEntries(['manifest', 'registry', 'planner', 'generator', 'validator'].map(name => [
      `@hcb/${name}`, fileURLToPath(new URL(`./packages/hcb-${name}/src/index.ts`, import.meta.url))
    ]))
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/hcb-cli/src/index.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { perFile: true, statements: 80, functions: 80, lines: 80, branches: 80 }
    }
  }
});
