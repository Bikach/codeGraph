#!/usr/bin/env node
/**
 * CodeGraph CLI
 *
 * Command-line interface for indexing code into Neo4j.
 * Designed to be called by Claude Code slash commands (zero tokens).
 *
 * Commands:
 *   index <path>  - Index a Kotlin project into Neo4j
 *   setup         - Start Neo4j via docker-compose
 *   status        - Check Neo4j connection and show graph stats
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { spawn, execSync } from 'child_process';
import { Neo4jClient } from './neo4j/neo4j.js';
import {
  getParserForFile,
  isFileSupported,
  getSupportedExtensions,
  resolveSymbols,
  getResolutionStats,
  Neo4jWriter,
  type ParsedFile,
} from './indexer/index.js';

// =============================================================================
// CLI Colors (simple ANSI codes, no dependency)
// =============================================================================

const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const symbols = {
  success: colors.green('✓'),
  error: colors.red('✗'),
  warning: colors.yellow('⚠'),
  info: colors.cyan('ℹ'),
  arrow: colors.dim('→'),
};

// =============================================================================
// Configuration
// =============================================================================

interface Config {
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
}

function getConfig(): Config {
  return {
    neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4jUser: process.env.NEO4J_USER || 'neo4j',
    neo4jPassword: process.env.NEO4J_PASSWORD || '',
  };
}

// =============================================================================
// File Scanner
// =============================================================================

interface ScanOptions {
  excludePatterns?: string[];
  excludeTests?: boolean;
}

async function scanFiles(basePath: string, options: ScanOptions = {}): Promise<string[]> {
  const files: string[] = [];

  const excludePatterns = options.excludePatterns || [];
  if (options.excludeTests) {
    excludePatterns.push('*Test.kt', '*Spec.kt', '*Tests.kt', '*IT.kt');
  }

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(basePath, fullPath);

      // Skip common non-source directories
      if (entry.isDirectory()) {
        const skipDirs = ['node_modules', '.git', 'build', 'out', 'target', '.gradle', '.idea'];
        if (skipDirs.includes(entry.name)) continue;
        await walk(fullPath);
        continue;
      }

      // Check if file is supported
      if (!isFileSupported(fullPath)) continue;

      // Check exclude patterns
      const shouldExclude = excludePatterns.some((pattern) => {
        // Simple glob matching: * matches any characters
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(entry.name) || regex.test(relativePath);
      });

      if (!shouldExclude) {
        files.push(fullPath);
      }
    }
  }

  await walk(basePath);
  return files.sort();
}

// =============================================================================
// Index Command
// =============================================================================

interface IndexOptions {
  clear?: boolean;
  excludePatterns?: string[];
  excludeTests?: boolean;
  domainsConfig?: string;
}

async function indexCommand(targetPath: string, options: IndexOptions): Promise<void> {
  const absolutePath = resolve(targetPath);
  console.log(`\nIndexing ${colors.cyan(absolutePath)}...\n`);

  // 1. Scan files
  console.log('Scanning files...');
  const files = await scanFiles(absolutePath, {
    excludePatterns: options.excludePatterns,
    excludeTests: options.excludeTests,
  });

  if (files.length === 0) {
    console.log(`${symbols.warning} No supported files found.`);
    console.log(`Supported extensions: ${getSupportedExtensions().join(', ')}`);
    return;
  }

  console.log(`${symbols.success} Found ${colors.bold(String(files.length))} files\n`);

  // 2. Parse files
  console.log('Parsing...');
  const parsedFiles: ParsedFile[] = [];
  let parseErrors = 0;

  for (const filePath of files) {
    try {
      const parser = await getParserForFile(filePath);
      if (!parser) continue;

      const content = await readFile(filePath, 'utf-8');
      const relativePath = relative(absolutePath, filePath);
      const parsed = await parser.parse(content, relativePath);
      parsedFiles.push(parsed);
    } catch (error) {
      parseErrors++;
      console.log(`  ${symbols.error} ${relative(absolutePath, filePath)}: ${error}`);
    }
  }

  console.log(
    `${symbols.success} ${colors.bold(String(parsedFiles.length))}/${files.length} files parsed` +
      (parseErrors > 0 ? ` (${parseErrors} errors)` : '') +
      '\n'
  );

  // 3. Resolve symbols
  console.log('Resolving symbols...');
  const resolvedFiles = resolveSymbols(parsedFiles);
  const stats = getResolutionStats(resolvedFiles);

  const resolutionPercent = Math.round(stats.resolutionRate * 100);
  console.log(
    `${symbols.success} ${colors.bold(String(stats.resolvedCalls))} calls resolved ` +
      `(${resolutionPercent}% resolution rate)\n`
  );

  // 4. Connect to Neo4j
  console.log('Connecting to Neo4j...');
  const config = getConfig();
  const client = new Neo4jClient(config.neo4jUri, config.neo4jUser, config.neo4jPassword);

  try {
    await client.connect();
    console.log(`${symbols.success} Connected to ${config.neo4jUri}\n`);
  } catch (error) {
    console.log(`${symbols.error} Failed to connect to Neo4j: ${error}`);
    console.log(`\nMake sure Neo4j is running. Try: ${colors.cyan('codegraph setup')}`);
    process.exit(1);
  }

  // 5. Write to Neo4j
  console.log('Writing to Neo4j...');
  const writer = new Neo4jWriter(client);

  try {
    const result = await writer.writeFiles(resolvedFiles, {
      clearBefore: options.clear,
      domainsConfigPath: options.domainsConfig,
    });

    console.log(`${symbols.success} ${colors.bold(String(result.nodesCreated))} nodes created`);
    console.log(
      `${symbols.success} ${colors.bold(String(result.relationshipsCreated))} relationships created`
    );

    if (result.errors.length > 0) {
      console.log(`${symbols.warning} ${result.errors.length} write errors`);
      for (const error of result.errors.slice(0, 5)) {
        console.log(`  ${symbols.error} ${error.filePath}: ${error.message}`);
      }
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
  } finally {
    await client.close();
  }

  console.log(`\n${colors.green('Done!')} Explore your code graph at ${colors.cyan('http://localhost:7474')}`);
}

// =============================================================================
// Setup Command
// =============================================================================

async function setupCommand(): Promise<void> {
  console.log('\nSetting up Neo4j...\n');

  // Check Docker
  console.log('Checking Docker...');
  try {
    execSync('docker info', { stdio: 'ignore' });
    console.log(`${symbols.success} Docker is running\n`);
  } catch {
    console.log(`${symbols.error} Docker is not running`);
    console.log('\nPlease start Docker Desktop and try again.');
    process.exit(1);
  }

  // Find docker-compose.yml
  const possiblePaths = [
    join(process.cwd(), 'docker-compose.yml'),
    join(process.cwd(), 'docker-compose.yaml'),
    // Look in plugin directory when installed as plugin
    join(import.meta.dirname, '..', '..', 'docker-compose.yml'),
    join(import.meta.dirname, '..', 'docker-compose.yml'),
  ];

  let composePath: string | undefined;
  for (const p of possiblePaths) {
    try {
      await stat(p);
      composePath = p;
      break;
    } catch {
      // Not found, continue
    }
  }

  if (!composePath) {
    console.log(`${symbols.error} docker-compose.yml not found`);
    console.log('\nCreate a docker-compose.yml with Neo4j configuration.');
    process.exit(1);
  }

  console.log(`Using ${colors.dim(composePath)}\n`);

  // Start Neo4j
  console.log('Starting Neo4j container...');
  const composeDir = join(composePath, '..');

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['compose', 'up', '-d'], {
      cwd: composeDir,
      stdio: 'inherit',
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        console.log(`${symbols.error} Failed to start Neo4j`);
        reject(new Error('docker-compose failed'));
        return;
      }

      console.log(`\n${symbols.success} Neo4j container started\n`);

      // Wait for Neo4j to be ready
      console.log('Waiting for Neo4j to be ready...');
      const config = getConfig();
      const client = new Neo4jClient(config.neo4jUri, config.neo4jUser, config.neo4jPassword);

      let retries = 30;
      while (retries > 0) {
        try {
          await client.connect();
          await client.close();
          console.log(`${symbols.success} Neo4j is ready at ${colors.cyan(config.neo4jUri)}`);
          console.log(`${symbols.success} Neo4j Browser: ${colors.cyan('http://localhost:7474')}`);
          console.log(
            `\n${colors.green('CodeGraph is ready!')} Use ${colors.cyan('codegraph index .')} to index a project.`
          );
          resolve();
          return;
        } catch {
          retries--;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      console.log(`${symbols.warning} Neo4j is starting but not ready yet.`);
      console.log('Try again in a few seconds.');
      resolve();
    });

    proc.on('error', (error) => {
      console.log(`${symbols.error} Failed to start docker-compose: ${error}`);
      reject(error);
    });
  });
}

// =============================================================================
// Status Command
// =============================================================================

async function statusCommand(): Promise<void> {
  console.log('\nChecking CodeGraph status...\n');

  const config = getConfig();
  const client = new Neo4jClient(config.neo4jUri, config.neo4jUser, config.neo4jPassword);

  try {
    await client.connect();
    console.log(`Neo4j: ${symbols.success} Connected (${config.neo4jUri})\n`);

    // Get graph statistics
    const statsQuery = `
      MATCH (n)
      WHERE n:Package OR n:Class OR n:Interface OR n:Object OR n:Function OR n:Property
      RETURN labels(n)[0] AS label, count(n) AS count
      ORDER BY count DESC
    `;

    const relStatsQuery = `
      MATCH ()-[r]->()
      WHERE type(r) IN ['CALLS', 'EXTENDS', 'IMPLEMENTS', 'DECLARES', 'CONTAINS', 'USES', 'RETURNS']
      RETURN type(r) AS type, count(r) AS count
      ORDER BY count DESC
    `;

    const nodeStats = await client.query<{ label: string; count: number }>(statsQuery);
    const relStats = await client.query<{ type: string; count: number }>(relStatsQuery);

    if (nodeStats.length === 0) {
      console.log('Graph is empty. Run `codegraph index <path>` to index a project.\n');
    } else {
      console.log('Graph statistics:');
      for (const row of nodeStats) {
        console.log(`  ${row.label.padEnd(12)} ${colors.bold(String(row.count))}`);
      }

      if (relStats.length > 0) {
        console.log('');
        for (const row of relStats) {
          console.log(`  ${row.type.padEnd(12)} ${colors.bold(String(row.count))}`);
        }
      }
      console.log('');
    }

    await client.close();
  } catch (error) {
    console.log(`Neo4j: ${symbols.error} Not connected`);
    console.log(`\nCould not connect to ${config.neo4jUri}`);
    console.log(`Run ${colors.cyan('codegraph setup')} to start Neo4j.`);
    process.exit(1);
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

function printUsage(): void {
  console.log(`
${colors.bold('CodeGraph CLI')} - Index code into Neo4j for analysis

${colors.bold('Usage:')}
  codegraph <command> [options]

${colors.bold('Commands:')}
  index <path>    Index a project into Neo4j
  setup           Start Neo4j via Docker
  status          Check Neo4j connection and show stats

${colors.bold('Index Options:')}
  --clear              Clear the graph before indexing
  --exclude <pattern>  Exclude files matching pattern (can be used multiple times)
  --exclude-tests      Exclude test files (*Test.kt, *Spec.kt, etc.)
  --domains <path>     Path to domains.yaml config file

${colors.bold('Environment Variables:')}
  NEO4J_URI       Neo4j connection URI (default: bolt://localhost:7687)
  NEO4J_USER      Neo4j username (default: neo4j)
  NEO4J_PASSWORD  Neo4j password (default: empty)

${colors.bold('Examples:')}
  codegraph setup                    # Start Neo4j
  codegraph index .                  # Index current directory
  codegraph index ./src --clear      # Re-index from scratch
  codegraph index . --exclude-tests  # Exclude test files
  codegraph status                   # Check graph stats
`);
}

function parseArgs(args: string[]): { command: string; target?: string; options: IndexOptions } {
  const options: IndexOptions = {
    excludePatterns: [],
  };

  let command = '';
  let target: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--clear') {
      options.clear = true;
    } else if (arg === '--exclude') {
      const pattern = args[++i];
      if (pattern) options.excludePatterns!.push(pattern);
    } else if (arg === '--exclude-tests') {
      options.excludeTests = true;
    } else if (arg === '--domains') {
      options.domainsConfig = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (!command) {
      command = arg;
    } else if (!target) {
      target = arg;
    }
  }

  return { command, target, options };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, target, options } = parseArgs(args);

  try {
    switch (command) {
      case 'index':
        if (!target) {
          console.log(`${symbols.error} Missing path argument`);
          console.log(`Usage: codegraph index <path>`);
          process.exit(1);
        }
        await indexCommand(target, options);
        break;

      case 'setup':
        await setupCommand();
        break;

      case 'status':
        await statusCommand();
        break;

      case 'help':
      case '':
        printUsage();
        break;

      default:
        console.log(`${symbols.error} Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`\n${symbols.error} Error: ${error}`);
    process.exit(1);
  }
}

main();
