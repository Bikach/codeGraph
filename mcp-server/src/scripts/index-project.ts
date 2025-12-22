#!/usr/bin/env npx tsx
/**
 * Index a source code project into Neo4j.
 * Returns JSON for Claude Code to interpret.
 */

import { resolve, basename } from 'path';
import { readdir, readFile, stat } from 'fs/promises';
import { Neo4jClient } from '../neo4j/neo4j.js';
import {
  getParserForFile,
  isFileSupported,
  buildSymbolTable,
  resolveSymbols,
  Neo4jWriter,
  type ParsedFile,
} from '../indexer/index.js';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

const SKIP_DIRS = ['node_modules', '.git', 'build', 'out', '.gradle', '.idea', 'target', 'dist'];
const TEST_DIR_PATTERNS = [/[/\\]test[/\\]/, /[/\\]tests[/\\]/, /[/\\]__tests__[/\\]/, /[/\\]androidTest[/\\]/];
const TEST_FILE_PATTERNS = [/Test\.[^.]+$/, /Tests\.[^.]+$/, /Spec\.[^.]+$/, /\.test\.[^.]+$/, /\.spec\.[^.]+$/];

interface IndexResult {
  success: boolean;
  projectPath: string;
  filesFound: number;
  filesParsed: number;
  parseErrors: number;
  symbolsResolved: number;
  nodesCreated: number;
  relationshipsCreated: number;
  writeErrors: number;
  dryRun: boolean;
  message?: string;
  errorMessage?: string;
  hint?: string;
}

function isTestFile(path: string): boolean {
  return TEST_DIR_PATTERNS.some((p) => p.test(path)) || TEST_FILE_PATTERNS.some((p) => p.test(path));
}

async function findSourceFiles(dir: string, excludeTests: boolean): Promise<string[]> {
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
        if (excludeTests && isTestFile(fullPath)) continue;
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files.sort();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const paths = args.filter((a) => !a.startsWith('--'));

  const clearBefore = flags.includes('--clear');
  const dryRun = flags.includes('--dry-run');
  const excludeTests = flags.includes('--exclude-tests');

  const result: IndexResult = {
    success: false,
    projectPath: '',
    filesFound: 0,
    filesParsed: 0,
    parseErrors: 0,
    symbolsResolved: 0,
    nodesCreated: 0,
    relationshipsCreated: 0,
    writeErrors: 0,
    dryRun,
  };

  if (paths.length === 0) {
    result.errorMessage = 'No project path provided';
    result.hint = 'Usage: npx tsx index-project.ts [--clear] [--exclude-tests] [--dry-run] <project-path>';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  const projectPath = resolve(paths[0]!);
  result.projectPath = projectPath;

  // Verify project exists
  try {
    const projectStat = await stat(projectPath);
    if (!projectStat.isDirectory()) {
      result.errorMessage = `Not a directory: ${projectPath}`;
      result.hint = 'Provide a valid directory path to index';
      console.log(JSON.stringify(result));
      process.exit(1);
    }
  } catch {
    result.errorMessage = `Project not found: ${projectPath}`;
    result.hint = 'Check that the path exists and is accessible';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  // 1. Find source files
  const files = await findSourceFiles(projectPath, excludeTests);
  result.filesFound = files.length;

  if (files.length === 0) {
    result.errorMessage = 'No supported source files found';
    result.hint = 'Currently supported: Kotlin (.kt, .kts). Make sure the project contains Kotlin files.';
    console.log(JSON.stringify(result));
    process.exit(0);
  }

  // 2. Parse files
  const parsedFiles: ParsedFile[] = [];

  for (const filePath of files) {
    try {
      const parser = await getParserForFile(filePath);
      if (parser) {
        const source = await readFile(filePath, 'utf-8');
        parsedFiles.push(await parser.parse(source, filePath));
      }
    } catch {
      result.parseErrors++;
    }
  }
  result.filesParsed = parsedFiles.length;

  // 3. Resolve symbols
  const symbolTable = buildSymbolTable(parsedFiles);
  const resolvedFiles = resolveSymbols(parsedFiles, symbolTable);
  result.symbolsResolved = symbolTable.byFqn.size;

  // 4. Write to Neo4j
  if (dryRun) {
    result.success = true;
    result.message = `Dry run completed. Parsed ${result.filesParsed} files, resolved ${result.symbolsResolved} symbols.`;
    console.log(JSON.stringify(result));
    return;
  }

  const client = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await client.connect();
  } catch (err) {
    result.errorMessage = `Failed to connect to Neo4j: ${err instanceof Error ? err.message : String(err)}`;
    result.hint = 'Run /codegraph:setup first to start Neo4j';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  try {
    const writer = new Neo4jWriter(client, { batchSize: 500 });

    const writeResult = await writer.writeFiles(resolvedFiles, {
      clearBefore,
      projectPath,
      projectName: basename(projectPath),
    });

    result.nodesCreated = writeResult.nodesCreated;
    result.relationshipsCreated = writeResult.relationshipsCreated;
    result.writeErrors = writeResult.errors.length;
    result.success = true;
    result.message = `Indexed ${result.filesParsed} files. Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships.`;
  } catch (err) {
    result.errorMessage = `Write failed: ${err instanceof Error ? err.message : String(err)}`;
    result.hint = 'Check Neo4j connection. Try running /codegraph:setup again.';
  } finally {
    await client.close();
  }

  console.log(JSON.stringify(result));
  if (!result.success) process.exit(1);
}

main().catch((err) => {
  console.log(JSON.stringify({
    success: false,
    errorMessage: err instanceof Error ? err.message : String(err),
    hint: 'An unexpected error occurred during indexing.',
  }));
  process.exit(1);
});
