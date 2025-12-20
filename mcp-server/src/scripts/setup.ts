#!/usr/bin/env npx tsx
/**
 * Setup Neo4j for CodeGraph.
 * Returns JSON for Claude Code to interpret.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { Neo4jClient } from '../neo4j/neo4j.js';
import { Neo4jWriter } from '../indexer/index.js';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

interface SetupResult {
  success: boolean;
  docker: boolean;
  container: boolean;
  neo4j: boolean;
  indexes: boolean;
  error?: string;
  neo4jUri?: string;
  browserUrl?: string;
}

function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findDockerCompose(): string | null {
  // Search from current working directory upwards
  const candidates = [
    resolve(process.cwd(), 'docker-compose.yml'),
    resolve(process.cwd(), 'plugin', 'docker-compose.yml'),
    resolve(process.cwd(), '..', 'docker-compose.yml'),
    resolve(process.cwd(), '..', 'plugin', 'docker-compose.yml'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function isNeo4jContainerRunning(): boolean {
  try {
    const output = execSync('docker ps --filter "name=codegraph-neo4j" --format "{{.Names}}"', { encoding: 'utf-8' });
    return output.trim() === 'codegraph-neo4j';
  } catch {
    return false;
  }
}

function startNeo4jContainer(composePath: string): boolean {
  try {
    execSync(`docker compose -f "${composePath}" up -d`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function waitForNeo4j(maxRetries = 30, delayMs = 2000): Promise<boolean> {
  const client = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect();
      await client.close();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

async function main(): Promise<void> {
  const result: SetupResult = {
    success: false,
    docker: false,
    container: false,
    neo4j: false,
    indexes: false,
  };

  // 1. Check Docker
  result.docker = isDockerRunning();
  if (!result.docker) {
    result.error = 'Docker is not running';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  // 2. Find and start container
  const composePath = findDockerCompose();
  if (!composePath) {
    result.error = 'docker-compose.yml not found';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  if (!isNeo4jContainerRunning()) {
    if (!startNeo4jContainer(composePath)) {
      result.error = 'Failed to start Neo4j container';
      console.log(JSON.stringify(result));
      process.exit(1);
    }
  }
  result.container = true;

  // 3. Wait for Neo4j
  result.neo4j = await waitForNeo4j();
  if (!result.neo4j) {
    result.error = 'Neo4j did not become ready';
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  // 4. Create indexes
  const client = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);
  try {
    await client.connect();
    const writer = new Neo4jWriter(client);
    await writer.ensureConstraintsAndIndexes();
    result.indexes = true;
  } catch (err) {
    result.error = `Failed to create indexes: ${err instanceof Error ? err.message : String(err)}`;
    console.log(JSON.stringify(result));
    process.exit(1);
  } finally {
    await client.close();
  }

  // Success
  result.success = true;
  result.neo4jUri = NEO4J_URI;
  result.browserUrl = 'http://localhost:7474';
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.log(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
