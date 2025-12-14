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
import { z } from 'zod';
import { Neo4jClient } from './neo4j.js';
import {
  handleFindClass,
  handleGetDependencies,
  handleGetImplementations,
  handleTraceCalls,
  handleSearchCode,
} from './tools/index.js';
import { config } from './config.js';

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
    // Tool: find_class
    this.server.registerTool(
      'find_class',
      {
        title: 'Find Class',
        description:
          'Search for a class or interface by name in the code graph. ' +
          'Returns compact format: "type | Name | visibility | filePath:line"',
        inputSchema: {
          name: z.string().describe('Name of the class or interface to search for'),
          exact_match: z
            .boolean()
            .optional()
            .default(false)
            .describe('If true, exact match. If false, partial match (CONTAINS)'),
        },
      },
      async ({ name, exact_match }) => {
        return await handleFindClass(this.neo4jClient, { name, exact_match: exact_match ?? false });
      }
    );

    // Tool: get_dependencies
    this.server.registerTool(
      'get_dependencies',
      {
        title: 'Get Dependencies',
        description:
          'List all direct and transitive dependencies of a class. ' +
          'Returns compact format: "depth | Type | Name | filePath"',
        inputSchema: {
          class_name: z.string().describe('Name of the class to get dependencies for'),
          depth: z
            .number()
            .min(1)
            .max(5)
            .optional()
            .default(1)
            .describe('Search depth (1 = direct only, 2+ = transitive)'),
          include_external: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include external dependencies (npm packages)'),
        },
      },
      async ({ class_name, depth, include_external }) => {
        return await handleGetDependencies(this.neo4jClient, {
          class_name,
          depth: depth ?? 1,
          include_external: include_external ?? false,
        });
      }
    );

    // Tool: get_implementations
    this.server.registerTool(
      'get_implementations',
      {
        title: 'Get Implementations',
        description:
          'Find all classes that implement a given interface. ' +
          'Returns compact format: "direct/indirect | ClassName | filePath:line"',
        inputSchema: {
          interface_name: z.string().describe('Name of the interface or abstract class'),
          include_indirect: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include indirect implementations (via inheritance)'),
        },
      },
      async ({ interface_name, include_indirect }) => {
        return await handleGetImplementations(this.neo4jClient, {
          interface_name,
          include_indirect: include_indirect ?? false,
        });
      }
    );

    // Tool: trace_calls
    this.server.registerTool(
      'trace_calls',
      {
        title: 'Trace Calls',
        description:
          'Trace function calls: who calls this function (callers) ' +
          'or which functions it calls (callees). ' +
          'Returns compact format: "direction:depth | Class.function() | filePath:line"',
        inputSchema: {
          function_name: z.string().describe('Name of the function to trace'),
          class_name: z
            .string()
            .optional()
            .describe('Name of the class containing the function (optional for disambiguation)'),
          direction: z
            .enum(['callers', 'callees', 'both'])
            .optional()
            .default('both')
            .describe('Trace direction: who calls (callers), who is called (callees), or both'),
          depth: z
            .number()
            .min(1)
            .max(5)
            .optional()
            .default(2)
            .describe('Trace depth'),
        },
      },
      async ({ function_name, class_name, direction, depth }) => {
        return await handleTraceCalls(this.neo4jClient, {
          function_name,
          class_name,
          direction: direction ?? 'both',
          depth: depth ?? 2,
        });
      }
    );

    // Tool: search_code
    this.server.registerTool(
      'search_code',
      {
        title: 'Search Code',
        description:
          'Full-text search in source code indexed in Neo4j. ' +
          'Returns compact format: "type | name | filePath:line"',
        inputSchema: {
          query: z.string().describe('Search term'),
          entity_types: z
            .array(z.enum(['class', 'function', 'property', 'interface']))
            .optional()
            .describe('Entity types to search (all if not specified)'),
          limit: z
            .number()
            .min(1)
            .max(100)
            .optional()
            .default(20)
            .describe('Maximum number of results'),
        },
      },
      async ({ query, entity_types, limit }) => {
        return await handleSearchCode(this.neo4jClient, {
          query,
          entity_types,
          limit: limit ?? 20,
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
