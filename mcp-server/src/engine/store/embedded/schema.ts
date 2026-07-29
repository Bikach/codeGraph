/**
 * Schema DDL + versioned auto-migration for the embedded store. Moved verbatim from
 * embedded-store.ts (ensureSchema / readSchemaVersion / dropDataTables); the only change is that
 * these are now functions taking an EmbeddedConnection instead of methods using `this`.
 */

import type { EmbeddedConnection } from './connection.js';
import { ALL_NODE_TABLES, REL_TABLES } from './shared.js';

/**
 * Bump on ANY node/rel table change. `ensureSchema` compares it to the version stored in the DB
 * and, on mismatch (incl. an old file with no version), drops & recreates all tables. Safe because
 * the indexer rebuilds all data anyway — so "old .lbug + new code" self-heals on the next index
 * instead of failing with a schema-mismatch on write.
 */
export const SCHEMA_VERSION = 5;

export async function ensureSchema(cx: EmbeddedConnection): Promise<void> {
  // Schema migration: if the DB's stored version differs (or is absent = old/new file),
  // drop all data tables so they get recreated below with the current shape.
  await cx.query('CREATE NODE TABLE IF NOT EXISTS SchemaMeta(key STRING PRIMARY KEY, version INT64)');
  if ((await readSchemaVersion(cx)) !== SCHEMA_VERSION) {
    await dropDataTables(cx);
  }

  // Node tables (type definitions + functions + properties + project).
  // `language` lets the writer scope name-based lookups to the same language, so a TS `User` never
  // links to a Java `User` (cross-language contamination). Combined with `filePath` (project scope).
  await cx.query(
    'CREATE NODE TABLE IF NOT EXISTS Function(fqn STRING PRIMARY KEY, name STRING, visibility STRING, filePath STRING, lineNumber INT64, language STRING)'
  );
  await cx.query(
    'CREATE NODE TABLE IF NOT EXISTS Class(fqn STRING PRIMARY KEY, name STRING, visibility STRING, filePath STRING, lineNumber INT64, language STRING)'
  );
  await cx.query(
    'CREATE NODE TABLE IF NOT EXISTS Interface(fqn STRING PRIMARY KEY, name STRING, visibility STRING, filePath STRING, lineNumber INT64, language STRING)'
  );
  await cx.query(
    'CREATE NODE TABLE IF NOT EXISTS Object(fqn STRING PRIMARY KEY, name STRING, visibility STRING, filePath STRING, lineNumber INT64, language STRING)'
  );
  await cx.query(
    'CREATE NODE TABLE IF NOT EXISTS Property(fqn STRING PRIMARY KEY, name STRING, visibility STRING, filePath STRING, lineNumber INT64, language STRING)'
  );
  await cx.query('CREATE NODE TABLE IF NOT EXISTS Project(path STRING PRIMARY KEY, name STRING)');
  // Domain: a named functional grouping of packages/modules (§3bis-B). id = `${projectPath}::${name}`
  // (scopes domains per project in a shared DB). `packages` = comma-joined matched packages/modules;
  // `prodPackages` = same minus the ones backed only by test files (for the `main` scope view).
  await cx.query(
    'CREATE NODE TABLE IF NOT EXISTS Domain(id STRING PRIMARY KEY, name STRING, projectPath STRING, fileCount INT64, prodFileCount INT64, packages STRING, prodPackages STRING)'
  );
  // Rel tables.
  await cx.query('CREATE REL TABLE IF NOT EXISTS CALLS(FROM Function TO Function)');
  await cx.query(
    'CREATE REL TABLE IF NOT EXISTS DECLARES(FROM Class TO Function, FROM Interface TO Function, FROM Object TO Function)'
  );
  await cx.query(
    'CREATE REL TABLE IF NOT EXISTS EXTENDS(FROM Class TO Class, FROM Interface TO Interface)'
  );
  await cx.query(
    'CREATE REL TABLE IF NOT EXISTS IMPLEMENTS(FROM Class TO Interface, FROM Object TO Interface)'
  );
  // USES: a function uses a type (param/receiver), OR a type uses another type (property field).
  await cx.query(
    `CREATE REL TABLE IF NOT EXISTS USES(
       FROM Function TO Class, FROM Function TO Interface,
       FROM Class TO Class, FROM Class TO Interface,
       FROM Interface TO Class, FROM Interface TO Interface,
       FROM Object TO Class, FROM Object TO Interface
     )`
  );
  // DEPENDS_ON: weighted cross-domain dependency (count of cross-domain semantic edges). `weight` =
  // all edges; `prodWeight` = edges whose both endpoints are prod (test files excluded).
  await cx.query(
    'CREATE REL TABLE IF NOT EXISTS DEPENDS_ON(FROM Domain TO Domain, weight INT64, prodWeight INT64)'
  );

  // Stamp the current schema version.
  await cx.run('MERGE (m:SchemaMeta {key: "schema"}) SET m.version = $v', {
    v: SCHEMA_VERSION,
  });
}

/** Stored schema version, or undefined if the DB predates versioning. */
export async function readSchemaVersion(cx: EmbeddedConnection): Promise<number | undefined> {
  const result = await cx.run('MATCH (m:SchemaMeta {key: "schema"}) RETURN m.version AS v');
  const rows = await result.getAll();
  return rows.length > 0 ? Number(rows[0]!.v) : undefined;
}

/** Drop every data table (rel tables first, then node tables). Keeps SchemaMeta. */
export async function dropDataTables(cx: EmbeddedConnection): Promise<void> {
  for (const table of REL_TABLES) await cx.query(`DROP TABLE IF EXISTS ${table}`);
  for (const table of ALL_NODE_TABLES) await cx.query(`DROP TABLE IF EXISTS ${table}`);
}
