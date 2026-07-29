#!/usr/bin/env npx tsx
/**
 * Index a source code project into the embedded graph (LadybugDB file at EMBEDDED_DB_PATH).
 * Returns JSON for Claude Code to interpret.
 */

import { resolve, basename } from 'path';
import { readdir, readFile, stat } from 'fs/promises';
import {
  getParserForFile,
  isFileSupported,
  getSupportedExtensions,
  buildSymbolTable,
  resolveSymbols,
  analyzeDomainsForGraph,
  type ParsedFile,
} from '../indexer/index.js';
import {
  shouldScanDirectory,
  shouldParseFile,
  isLikelyMinified,
  type FileFilterOptions,
} from '../indexer/index.js';
import { config } from '../config/config.js';
import { EmbeddedConnection } from '../engine/store/embedded/connection.js';
import { EmbeddedWriter } from '../engine/store/embedded/embedded-writer.js';

interface ParseError {
  filePath: string;
  error: string;
}

interface IndexResult {
  success: boolean;
  projectPath: string;
  filesFound: number;
  filesParsed: number;
  parseErrors: number;
  parseErrorDetails?: ParseError[];
  symbolsResolved: number;
  nodesCreated: number;
  relationshipsCreated: number;
  domainsCreated: number;
  domainDependenciesCreated: number;
  writeErrors: number;
  dryRun: boolean;
  message?: string;
  errorMessage?: string;
  hint?: string;
}

async function findSourceFiles(dir: string, excludeTests: boolean): Promise<string[]> {
  const files: string[] = [];

  const filterOptions: FileFilterOptions = {
    includeTestFiles: !excludeTests,
    includeDeclarationFiles: false,
    includeConfigFiles: false,
  };

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Use centralized directory filtering (pass fullPath for nested exclusions)
        if (shouldScanDirectory(entry.name, filterOptions, fullPath)) {
          await scan(fullPath);
        }
      } else if (entry.isFile() && isFileSupported(fullPath)) {
        // Use centralized file filtering
        if (shouldParseFile(fullPath, filterOptions)) {
          files.push(fullPath);
        }
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

  const dryRun = flags.includes('--dry-run');
  const excludeTests = flags.includes('--exclude-tests');
  const verbose = flags.includes('--verbose');

  const result: IndexResult = {
    success: false,
    projectPath: '',
    filesFound: 0,
    filesParsed: 0,
    parseErrors: 0,
    symbolsResolved: 0,
    nodesCreated: 0,
    relationshipsCreated: 0,
    domainsCreated: 0,
    domainDependenciesCreated: 0,
    writeErrors: 0,
    dryRun,
  };

  if (paths.length === 0) {
    result.errorMessage = 'No project path provided';
    result.hint = 'Usage: npx tsx index-project.ts [--exclude-tests] [--dry-run] [--verbose] <project-path>';
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
    const extensions = getSupportedExtensions().join(', ');
    result.errorMessage = 'No supported source files found';
    result.hint = `Supported extensions: ${extensions}`;
    console.log(JSON.stringify(result));
    process.exit(0);
  }

  // 2. Parse files
  const parsedFiles: ParsedFile[] = [];
  const parseErrorDetails: ParseError[] = [];

  for (const filePath of files) {
    try {
      const parser = await getParserForFile(filePath);
      if (parser) {
        const source = await readFile(filePath, 'utf-8');
        // Skip minified/bundled JS-TS that slipped past the name filters (vendored lib, checked-in
        // bundle) — they explode into thousands of junk nodes. Content check, so it needs the source.
        if (isLikelyMinified(filePath, source)) continue;
        parsedFiles.push(await parser.parse(source, filePath));
      }
    } catch (err) {
      result.parseErrors++;
      if (verbose) {
        parseErrorDetails.push({
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  result.filesParsed = parsedFiles.length;
  if (verbose && parseErrorDetails.length > 0) {
    result.parseErrorDetails = parseErrorDetails;
  }

  // 3. Resolve symbols
  const symbolTable = buildSymbolTable(parsedFiles);
  const resolvedFiles = resolveSymbols(parsedFiles, symbolTable);
  result.symbolsResolved = symbolTable.byFqn.size;

  // 4. Write to the embedded graph
  if (dryRun) {
    result.success = true;
    result.message = `Dry run completed. Parsed ${result.filesParsed} files, resolved ${result.symbolsResolved} symbols.`;
    console.log(JSON.stringify(result));
    return;
  }

  // Write to the embedded LadybugDB file (same path the MCP server reads from).
  const cx = new EmbeddedConnection(config.embedded.dbPath);

  try {
    await cx.open();
  } catch (err) {
    result.errorMessage = `Failed to open embedded store: ${err instanceof Error ? err.message : String(err)}`;
    result.hint = 'Check EMBEDDED_DB_PATH points to a writable location.';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  const writer = new EmbeddedWriter(cx);

  try {
    await writer.ensureSchema();
    // Always replace this project's data (idempotent reindex). Scoped to projectPath, so other
    // projects in the same DB file are untouched.
    await writer.clearGraph(projectPath);

    const writeResult = await writer.writeFiles(resolvedFiles, {
      projectPath,
      projectName: basename(projectPath),
    });

    result.nodesCreated = writeResult.nodesCreated;
    result.relationshipsCreated = writeResult.relationshipsCreated;
    result.writeErrors = writeResult.errors.length;

    // Global analysis (§3bis-B): infer named domains (cross-language: package or inferred module
    // path) and persist them; writeDomains derives file counts + cross-domain deps from the persisted
    // graph edges (same CALLS/USES/EXTENDS/IMPLEMENTS set god-nodes reads), split prod vs all.
    const domainAnalysis = await analyzeDomainsForGraph(resolvedFiles, { projectPath });
    const domainResult = await writer.writeDomains(domainAnalysis, projectPath);
    result.domainsCreated = domainResult.domainsCreated;
    result.domainDependenciesCreated = domainResult.dependenciesCreated;

    result.success = true;
    result.message = `Indexed ${result.filesParsed} files. Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships. Detected ${result.domainsCreated} domains (${result.domainDependenciesCreated} cross-domain deps).`;
  } catch (err) {
    result.errorMessage = `Write failed: ${err instanceof Error ? err.message : String(err)}`;
    result.hint = 'Check EMBEDDED_DB_PATH and that the file is writable.';
  } finally {
    await cx.close();
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
