/**
 * One-off utility: empty ALL graph content from the embedded LadybugDB file (every project),
 * keeping the file and its schema. Use when projects got mixed into one DB and you want a clean slate.
 *
 * Usage: npx tsx src/scripts/clear-graph.ts <db-path>
 *        (falls back to EMBEDDED_DB_PATH if no path is given)
 */
import { EmbeddedConnection } from '../engine/store/embedded/connection.js';
import { EmbeddedWriter } from '../engine/store/embedded/embedded-writer.js';

async function main(): Promise<void> {
  const dbPath = process.argv[2] ?? process.env.EMBEDDED_DB_PATH;
  if (!dbPath) {
    console.error('No DB path. Pass it as an argument or set EMBEDDED_DB_PATH.');
    process.exit(1);
  }

  const cx = new EmbeddedConnection(dbPath);
  await cx.open();
  try {
    const writer = new EmbeddedWriter(cx);
    await writer.ensureSchema();
    const result = await writer.clearGraph(); // no projectPath → clears everything
    console.log(`Cleared ${dbPath}:`, result);
  } finally {
    await cx.close();
  }
}

main().catch((err) => {
  console.error('Failed to clear graph:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
