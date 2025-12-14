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

/**
 * Server configuration from environment variables
 */
const config = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },
  server: {
    name: 'codegraph-server',
    version: '0.1.0',
  },
};

/**
 * Main MCP server class
 */
class CodeGraphServer {
  private server: McpServer;
  private neo4jClient: Neo4jClient;

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
   * Register all MCP tools with Zod schemas
   */
  private registerTools(): void {
    // Tool: find_class
    this.server.tool(
      'find_class',
      'Search for a class or interface by name in the code graph. ' +
        'Returns detailed information including file path, ' +
        'properties, methods, and relationships.',
      {
        name: z.string().describe('Name of the class or interface to search for'),
        exact_match: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, exact match. If false, partial match (CONTAINS)'),
      },
      async ({ name, exact_match }) => {
        return await this.handleFindClass({ name, exact_match });
      }
    );

    // Tool: get_dependencies
    this.server.tool(
      'get_dependencies',
      'List all direct and transitive dependencies of a class. ' +
        'Useful for understanding change impact or analyzing coupling.',
      {
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
      async ({ class_name, depth, include_external }) => {
        return await this.handleGetDependencies({ class_name, depth, include_external });
      }
    );

    // Tool: get_implementations
    this.server.tool(
      'get_implementations',
      'Find all classes that implement a given interface. ' +
        'Supports TypeScript interfaces and abstract classes.',
      {
        interface_name: z.string().describe('Name of the interface or abstract class'),
        include_indirect: z
          .boolean()
          .optional()
          .default(false)
          .describe('Include indirect implementations (via inheritance)'),
      },
      async ({ interface_name, include_indirect }) => {
        return await this.handleGetImplementations({ interface_name, include_indirect });
      }
    );

    // Tool: trace_calls
    this.server.tool(
      'trace_calls',
      'Trace function calls: who calls this function (callers) ' +
        'or which functions it calls (callees). Useful for impact analysis.',
      {
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
      async ({ function_name, class_name, direction, depth }) => {
        return await this.handleTraceCalls({ function_name, class_name, direction, depth });
      }
    );

    // Tool: search_code
    this.server.tool(
      'search_code',
      'Full-text search in source code indexed in Neo4j. ' +
        'Searches in class names, functions, properties, and comments.',
      {
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
      async ({ query, entity_types, limit }) => {
        return await this.handleSearchCode({ query, entity_types, limit });
      }
    );
  }

  /**
   * Tool Handler: find_class
   * TODO: Implement class search logic via Neo4j
   */
  private async handleFindClass(args: { name: string; exact_match: boolean }) {
    // TODO: Implementation
    // - Validate arguments
    // - Build Cypher query
    // - Execute via neo4jClient
    // - Format results
    return {
      content: [
        {
          type: 'text' as const,
          text: `TODO: Implement find_class for "${args.name}"`,
        },
      ],
    };
  }

  /**
   * Tool Handler: get_dependencies
   * TODO: Implement dependency analysis
   */
  private async handleGetDependencies(args: {
    class_name: string;
    depth: number;
    include_external: boolean;
  }) {
    // TODO: Implementation
    // - Cypher query with path variable based on depth
    // - Filter external dependencies if needed
    return {
      content: [
        {
          type: 'text' as const,
          text: `TODO: Implement get_dependencies for "${args.class_name}"`,
        },
      ],
    };
  }

  /**
   * Tool Handler: get_implementations
   * TODO: Implement implementations search
   */
  private async handleGetImplementations(args: {
    interface_name: string;
    include_indirect: boolean;
  }) {
    // TODO: Implementation
    // - Search for IMPLEMENTS relationships
    // - If include_indirect, traverse inheritance tree
    return {
      content: [
        {
          type: 'text' as const,
          text: `TODO: Implement get_implementations for "${args.interface_name}"`,
        },
      ],
    };
  }

  /**
   * Tool Handler: trace_calls
   * TODO: Implement call tracing
   */
  private async handleTraceCalls(args: {
    function_name: string;
    class_name?: string;
    direction: 'callers' | 'callees' | 'both';
    depth: number;
  }) {
    // TODO: Implementation
    // - Build query based on direction (callers/callees/both)
    // - Traverse graph based on depth
    return {
      content: [
        {
          type: 'text' as const,
          text: `TODO: Implement trace_calls for "${args.function_name}"`,
        },
      ],
    };
  }

  /**
   * Tool Handler: search_code
   * TODO: Implement full-text search
   */
  private async handleSearchCode(args: {
    query: string;
    entity_types?: Array<'class' | 'function' | 'property' | 'interface'>;
    limit: number;
  }) {
    // TODO: Implementation
    // - Use Neo4j full-text indexes
    // - Filter by entity_types if specified
    // - Limit results
    return {
      content: [
        {
          type: 'text' as const,
          text: `TODO: Implement search_code for "${args.query}"`,
        },
      ],
    };
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
