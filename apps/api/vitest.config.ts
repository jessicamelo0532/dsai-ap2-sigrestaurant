import { defineConfig } from 'vitest/config';

// Testes de integração da API contra PostgreSQL real.
// SPEC: SPEC/2026-11-12-reativacao-backend.md
export default defineConfig({
  // O NestJS usa decorators no estilo legado (experimentalDecorators).
  oxc: {
    decorator: { legacy: true },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    // Todos os arquivos usam o mesmo banco de teste; rodar um por vez evita interferência.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
