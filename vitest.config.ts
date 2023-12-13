import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^(.*)\.js$/,
        replacement: '$1',
      },
    ],
  },
  test: {
    environment: 'node',
    pool: 'forks',
    setupFiles: ['vitest.setup.js'],
  },
});
