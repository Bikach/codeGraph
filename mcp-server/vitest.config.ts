import { defineConfig } from 'vitest/config';

/**
 * All tests are now pure & in-memory (LadybugDB embedded, no Docker) since Neo4j was removed.
 * No more integration/unit split — everything runs in parallel.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
