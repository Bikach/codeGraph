import { defineConfig } from 'vitest/config';

/**
 * All tests are pure & in-memory (LadybugDB embedded, no external services).
 * No integration/unit split — everything runs in parallel.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
