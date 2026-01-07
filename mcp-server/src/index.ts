#!/usr/bin/env node

/**
 * CodeGraph MCP Server
 *
 * MCP (Model Context Protocol) server that exposes the Neo4j code graph
 * to LLMs for code analysis and navigation.
 *
 * Configuration via environment variables:
 * - NEO4J_URI: Neo4j connection URI (default: bolt://localhost:7687)
 * - NEO4J_USER: Neo4j user (default: neo4j)
 * - NEO4J_PASSWORD: Neo4j password (required)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Neo4jClient } from './neo4j/neo4j.js';
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
} from './tools/index.js';
import { config } from './config/config.js';

/**
 * Main MCP server class
 */
class CodeGraphServer {
  private server: McpServer;
  private readonly neo4jClient: Neo4jClient;

  constructor() {
    // Initialize MCP server
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });

    // Initialize Neo4j client
    this.neo4jClient = new Neo4jClient(
      config.neo4j.uri,
      config.neo4j.user,
      config.neo4j.password
    );

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
      async ({ query, node_types, exact_match, limit }) => {
        return await handleSearchNodes(this.neo4jClient, {
          query,
          node_types,
          exact_match: exact_match ?? false,
          limit: limit ?? 20,
        });
      }
    );

    // Tool: get_callers
    this.server.registerTool(
      getCallersDefinition.name,
      {
        title: getCallersDefinition.title,
        description: getCallersDefinition.description,
        inputSchema: getCallersDefinition.inputSchema,
      },
      async ({ function_name, class_name, depth }) => {
        return await handleGetCallers(this.neo4jClient, {
          function_name,
          class_name,
          depth: depth ?? 2,
        });
      }
    );

    // Tool: get_callees
    this.server.registerTool(
      getCalleesDefinition.name,
      {
        title: getCalleesDefinition.title,
        description: getCalleesDefinition.description,
        inputSchema: getCalleesDefinition.inputSchema,
      },
      async ({ function_name, class_name, depth }) => {
        return await handleGetCallees(this.neo4jClient, {
          function_name,
          class_name,
          depth: depth ?? 2,
        });
      }
    );

    // Tool: get_neighbors
    this.server.registerTool(
      getNeighborsDefinition.name,
      {
        title: getNeighborsDefinition.title,
        description: getNeighborsDefinition.description,
        inputSchema: getNeighborsDefinition.inputSchema,
      },
      async ({ node_name, direction, depth, include_external }) => {
        return await handleGetNeighbors(this.neo4jClient, {
          node_name,
          direction: direction ?? 'both',
          depth: depth ?? 1,
          include_external: include_external ?? false,
        });
      }
    );

    // Tool: get_implementations
    this.server.registerTool(
      getImplementationsDefinition.name,
      {
        title: getImplementationsDefinition.title,
        description: getImplementationsDefinition.description,
        inputSchema: getImplementationsDefinition.inputSchema,
      },
      async ({ interface_name, include_indirect }) => {
        return await handleGetImplementations(this.neo4jClient, {
          interface_name,
          include_indirect: include_indirect ?? false,
        });
      }
    );

    // Tool: get_impact
    this.server.registerTool(
      getImpactDefinition.name,
      {
        title: getImpactDefinition.title,
        description: getImpactDefinition.description,
        inputSchema: getImpactDefinition.inputSchema,
      },
      async ({ node_name, node_type, depth }) => {
        return await handleGetImpact(this.neo4jClient, {
          node_name,
          node_type,
          depth: depth ?? 3,
        });
      }
    );

    // Tool: find_path
    this.server.registerTool(
      findPathDefinition.name,
      {
        title: findPathDefinition.title,
        description: findPathDefinition.description,
        inputSchema: findPathDefinition.inputSchema,
      },
      async ({ from_node, to_node, max_depth, relationship_types }) => {
        return await handleFindPath(this.neo4jClient, {
          from_node,
          to_node,
          max_depth: max_depth ?? 5,
          relationship_types,
        });
      }
    );

    // Tool: get_file_symbols
    this.server.registerTool(
      getFileSymbolsDefinition.name,
      {
        title: getFileSymbolsDefinition.title,
        description: getFileSymbolsDefinition.description,
        inputSchema: getFileSymbolsDefinition.inputSchema,
      },
      async ({ file_path, include_private }) => {
        return await handleGetFileSymbols(this.neo4jClient, {
          file_path,
          include_private: include_private ?? true,
        });
      }
    );
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Verify Neo4j connection
    await this.neo4jClient.connect();
    console.error('Connected to Neo4j');

    // Start stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('CodeGraph MCP Server running on stdio');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.neo4jClient.close();
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
