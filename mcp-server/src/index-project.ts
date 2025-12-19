#!/usr/bin/env npx tsx
/**
 * Index a source code project into the Neo4j graph database.
 *
 * Usage:
 *   npx tsx src/index-project.ts /path/to/project
 *
 * Options:
 *   --clear          Clear database before indexing
 *   --dry-run        Parse and resolve only, skip Neo4j write
 *   --exclude-tests  Exclude test files and directories
 */

import { resolve } from 'path';
import { readdir, readFile, stat } from 'fs/promises';
import { Neo4jClient } from './neo4j/neo4j.js';
import {
  getParserForFile,
  isFileSupported,
  buildSymbolTable,
  resolveSymbols,
  Neo4jWriter,
  type ParsedFile,
} from './indexer/index.js';

// =============================================================================
// Configuration
// =============================================================================

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

/** Directories to skip when scanning */
const SKIP_DIRS = ['node_modules', '.git', 'build', 'out', '.gradle', '.idea', 'target', 'dist'];

/** Test directory patterns (language-agnostic) */
const TEST_DIR_PATTERNS = [/[/\\]test[/\\]/, /[/\\]tests[/\\]/, /[/\\]__tests__[/\\]/, /[/\\]androidTest[/\\]/];

/** Test file patterns (language-agnostic) */
const TEST_FILE_PATTERNS = [/Test\.[^.]+$/, /Tests\.[^.]+$/, /Spec\.[^.]+$/, /\.test\.[^.]+$/, /\.spec\.[^.]+$/];

// =============================================================================
// File Discovery
// =============================================================================

interface ScanOptions {
  excludeTests?: boolean;
}

function isTestFile(path: string): boolean {
  return TEST_DIR_PATTERNS.some((p) => p.test(path)) || TEST_FILE_PATTERNS.some((p) => p.test(path));
}

async function findSourceFiles(dir: string, options: ScanOptions = {}): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name)) {
          await scan(fullPath);
        }
      } else if (entry.isFile() && isFileSupported(fullPath)) {
        if (options.excludeTests && isTestFile(fullPath)) {
          continue;
        }
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files.sort();
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const paths = args.filter((a) => !a.startsWith('--'));

  const clearBefore = flags.includes('--clear');
  const dryRun = flags.includes('--dry-run');
  const excludeTests = flags.includes('--exclude-tests');

  if (paths.length === 0) {
    console.log('Usage: npx tsx src/index-project.ts [options] <project-path>');
    console.log('');
    console.log('Options:');
    console.log('  --clear          Clear database before indexing');
    console.log('  --dry-run        Parse and resolve only, skip Neo4j write');
    console.log('  --exclude-tests  Exclude test files and directories');
    process.exit(1);
  }

  const projectPath = resolve(paths[0]!);

  // Verify project exists
  try {
    const projectStat = await stat(projectPath);
    if (!projectStat.isDirectory()) {
      console.error(`Error: Not a directory: ${projectPath}`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Project not found: ${projectPath}`);
    process.exit(1);
  }

  // 1. Find source files
  console.log(`Scanning ${projectPath}...`);
  const files = await findSourceFiles(projectPath, { excludeTests });
  console.log(`Found ${files.length} source files`);

  if (files.length === 0) {
    console.log('No supported source files found.');
    process.exit(0);
  }

  // 2. Parse files
  console.log('Parsing...');
  const parsedFiles: ParsedFile[] = [];
  const parseErrors: string[] = [];

  for (const filePath of files) {
    try {
      const parser = await getParserForFile(filePath);
      if (parser) {
        const source = await readFile(filePath, 'utf-8');
        parsedFiles.push(await parser.parse(source, filePath));
      }
    } catch (err) {
      parseErrors.push(filePath);
    }
  }

  console.log(`Parsed ${parsedFiles.length}/${files.length} files`);
  if (parseErrors.length > 0) {
    console.log(`  (${parseErrors.length} parse errors)`);
  }

  // 3. Resolve symbols
  console.log('Resolving symbols...');
  const symbolTable = buildSymbolTable(parsedFiles);
  const resolvedFiles = resolveSymbols(parsedFiles, symbolTable);
  console.log(`Symbol table: ${symbolTable.byFqn.size} symbols`);

  // 4. Write to Neo4j
  if (dryRun) {
    console.log('Dry run - skipping Neo4j write');
    return;
  }

  console.log(`Connecting to ${NEO4J_URI}...`);
  const client = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await client.connect();
  } catch (err) {
    console.error(`Error: Failed to connect to Neo4j: ${err instanceof Error ? err.message : String(err)}`);
    console.log('Make sure Neo4j is running: docker-compose up -d');
    process.exit(1);
  }

  try {
    const writer = new Neo4jWriter(client, { batchSize: 500, clearBefore });

    if (clearBefore) {
      console.log('Clearing database...');
      const clearResult = await writer.clearGraph();
      console.log(`Cleared ${clearResult.nodesDeleted} nodes, ${clearResult.relationshipsDeleted} relationships`);
    }

    console.log('Ensuring indexes...');
    await writer.ensureConstraintsAndIndexes();

    console.log('Writing graph...');
    const result = await writer.writeFiles(resolvedFiles);

    console.log('');
    console.log(`Done: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);

    if (result.errors.length > 0) {
      console.log(`  (${result.errors.length} write errors)`);
    }

    // 5. Show example queries
    console.log('');
    console.log('Explore your graph at http://localhost:7474');
    console.log('');
    console.log('Example Cypher queries:');
    console.log('  MATCH (c:Class) RETURN c.name, c.fqn LIMIT 10');
    console.log('  MATCH (f:Function)-[:CALLS]->(g:Function) RETURN f.name, g.name LIMIT 10');
    console.log('  MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface) RETURN c.name, i.name');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
