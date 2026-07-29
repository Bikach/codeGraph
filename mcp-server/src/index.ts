#!/usr/bin/env node

/**
 * CodeGraph MCP Server
 *
 * MCP (Model Context Protocol) server that exposes the embedded code graph
 * (LadybugDB) to LLMs for code analysis and navigation.
 *
 * The graph is a single on-disk file produced by the indexer. The server opens it
 * READ-ONLY and PER REQUEST (open → read → close), holding no handle in between, so
 * the indexer can rewrite the file at any time and the next request sees fresh data.
 *
 * Configuration via environment variables:
 * - EMBEDDED_DB_PATH: path to the LadybugDB file (written by the indexer)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { EmbeddedConnection } from './engine/store/embedded/connection.js';
import { EmbeddedReader } from './engine/store/embedded/embedded-reader.js';
import {
  searchNodesDefinition,
  handleSearchNodes,
  getCallersDefinition,
  handleGetCallers,
  getCalleesDefinition,
  handleGetCallees,
  getNeighborsDefinition,
  handleGetNeighbors,
  getImplementationsDefinition,
  handleGetImplementations,
  getImpactDefinition,
  handleGetImpact,
  findPathDefinition,
  handleFindPath,
  getFileSymbolsDefinition,
  handleGetFileSymbols,
  getGodNodesDefinition,
  handleGetGodNodes,
  getModuleOverviewDefinition,
  handleGetModuleOverview,
} from './tools/index.js';
import { config } from './config/config.js';

/**
 * Main MCP server class
 */
class CodeGraphServer {
  private server: McpServer;

  constructor() {
    // Initialize MCP server
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });

    // Register tools
    this.registerTools();

    // Error handling via underlying server
    this.server.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Run a read against a freshly-opened, read-only embedded store, then close it.
   * Opening per request (not holding the file) lets the indexer rewrite the graph without
   * restarting the server — the next request sees the latest data. Cost ~38ms on a 10MB DB.
   */
  private async read<T>(fn: (store: EmbeddedReader) => Promise<T>): Promise<T> {
    const cx = new EmbeddedConnection(config.embedded.dbPath, { readOnly: true });
    await cx.open();
    try {
      return await fn(new EmbeddedReader(cx));
    } finally {
      await cx.close();
    }
  }

  /**
   * Register all MCP tools with modern registerTool API
   */
  private registerTools(): void {
    // Tool: search_nodes
    this.server.registerTool(
      searchNodesDefinition.name,
      {
        title: searchNodesDefinition.title,
        description: searchNodesDefinition.description,
        inputSchema: searchNodesDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleSearchNodes(store, args))
    );

    // Tool: get_callers
    this.server.registerTool(
      getCallersDefinition.name,
      {
        title: getCallersDefinition.title,
        description: getCallersDefinition.description,
        inputSchema: getCallersDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetCallers(store, args))
    );

    // Tool: get_callees
    this.server.registerTool(
      getCalleesDefinition.name,
      {
        title: getCalleesDefinition.title,
        description: getCalleesDefinition.description,
        inputSchema: getCalleesDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetCallees(store, args))
    );

    // Tool: get_neighbors
    this.server.registerTool(
      getNeighborsDefinition.name,
      {
        title: getNeighborsDefinition.title,
        description: getNeighborsDefinition.description,
        inputSchema: getNeighborsDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetNeighbors(store, args))
    );

    // Tool: get_implementations
    this.server.registerTool(
      getImplementationsDefinition.name,
      {
        title: getImplementationsDefinition.title,
        description: getImplementationsDefinition.description,
        inputSchema: getImplementationsDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetImplementations(store, args))
    );

    // Tool: get_impact
    this.server.registerTool(
      getImpactDefinition.name,
      {
        title: getImpactDefinition.title,
        description: getImpactDefinition.description,
        inputSchema: getImpactDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetImpact(store, args))
    );

    // Tool: find_path
    this.server.registerTool(
      findPathDefinition.name,
      {
        title: findPathDefinition.title,
        description: findPathDefinition.description,
        inputSchema: findPathDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleFindPath(store, args))
    );

    // Tool: get_file_symbols
    this.server.registerTool(
      getFileSymbolsDefinition.name,
      {
        title: getFileSymbolsDefinition.title,
        description: getFileSymbolsDefinition.description,
        inputSchema: getFileSymbolsDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetFileSymbols(store, args))
    );

    // Tool: get_god_nodes
    this.server.registerTool(
      getGodNodesDefinition.name,
      {
        title: getGodNodesDefinition.title,
        description: getGodNodesDefinition.description,
        inputSchema: getGodNodesDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetGodNodes(store, args))
    );

    // Tool: get_module_overview
    this.server.registerTool(
      getModuleOverviewDefinition.name,
      {
        title: getModuleOverviewDefinition.title,
        description: getModuleOverviewDefinition.description,
        inputSchema: getModuleOverviewDefinition.inputSchema,
      },
      async (args) => this.read((store) => handleGetModuleOverview(store, args))
    );
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Validate the embedded DB is present & readable (then every request opens it read-only).
    try {
      await this.read(async () => undefined);
      console.error(`CodeGraph embedded store ready: ${config.embedded.dbPath ?? '(in-memory)'}`);
    } catch (err) {
      console.error(
        `CodeGraph: cannot open embedded DB at ${config.embedded.dbPath ?? '(EMBEDDED_DB_PATH unset)'} — run the indexer first. ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Start stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('CodeGraph MCP Server running on stdio');
  }

  /**
   * Cleanup resources (nothing is held open between requests)
   */
  async cleanup(): Promise<void> {
    await this.server.close();
  }
}

/**
 * Entry point
 */
async function main() {
  const server = new CodeGraphServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
