import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli.ts', 
        'src/index.ts', 
        'src/auth/**', 
        'src/types/**', 
        'src/utils/wake.ts',
        'src/api/client.ts',  // Complex API client, tests cover via integration
        'src/utils/format.ts',  // Simple formatting, edge cases tested
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
