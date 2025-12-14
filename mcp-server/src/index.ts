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
 * Output schema definitions for structured responses
 */
const ClassInfoSchema = z.object({
  name: z.string(),
  type: z.enum(['class', 'interface', 'object']),
  filePath: z.string(),
  lineNumber: z.number(),
  visibility: z.string(),
  properties: z.record(z.string(), z.string()).optional(),
});

const DependencySchema = z.object({
  name: z.string(),
  type: z.string(),
  depth: z.number(),
  filePath: z.string().optional(),
});

const ImplementationSchema = z.object({
  name: z.string(),
  filePath: z.string(),
  lineNumber: z.number(),
  isDirect: z.boolean(),
});

const CallTraceSchema = z.object({
  functionName: z.string(),
  className: z.string().optional(),
  filePath: z.string(),
  lineNumber: z.number(),
  direction: z.enum(['caller', 'callee']),
  depth: z.number(),
});

const SearchResultSchema = z.object({
  name: z.string(),
  type: z.enum(['class', 'function', 'property', 'interface']),
  filePath: z.string(),
  lineNumber: z.number(),
  snippet: z.string().optional(),
});

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
          'Returns detailed information including file path, properties, methods, and relationships.',
        inputSchema: {
          name: z.string().describe('Name of the class or interface to search for'),
          exact_match: z
            .boolean()
            .optional()
            .default(false)
            .describe('If true, exact match. If false, partial match (CONTAINS)'),
        },
        outputSchema: {
          classes: z.array(ClassInfoSchema),
          count: z.number(),
        },
      },
      async ({ name, exact_match }) => {
        return await this.handleFindClass({ name, exact_match: exact_match ?? false });
      }
    );

    // Tool: get_dependencies
    this.server.registerTool(
      'get_dependencies',
      {
        title: 'Get Dependencies',
        description:
          'List all direct and transitive dependencies of a class. ' +
          'Useful for understanding change impact or analyzing coupling.',
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
        outputSchema: {
          dependencies: z.array(DependencySchema),
          count: z.number(),
        },
      },
      async ({ class_name, depth, include_external }) => {
        return await this.handleGetDependencies({
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
          'Supports TypeScript interfaces and abstract classes.',
        inputSchema: {
          interface_name: z.string().describe('Name of the interface or abstract class'),
          include_indirect: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include indirect implementations (via inheritance)'),
        },
        outputSchema: {
          implementations: z.array(ImplementationSchema),
          count: z.number(),
        },
      },
      async ({ interface_name, include_indirect }) => {
        return await this.handleGetImplementations({
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
          'or which functions it calls (callees). Useful for impact analysis.',
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
        outputSchema: {
          traces: z.array(CallTraceSchema),
          count: z.number(),
        },
      },
      async ({ function_name, class_name, direction, depth }) => {
        return await this.handleTraceCalls({
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
          'Searches in class names, functions, properties, and comments.',
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
        outputSchema: {
          results: z.array(SearchResultSchema),
          count: z.number(),
        },
      },
      async ({ query, entity_types, limit }) => {
        return await this.handleSearchCode({
          query,
          entity_types,
          limit: limit ?? 20,
        });
      }
    );
  }

  /**
   * Tool Handler: find_class
   */
  private async handleFindClass(_args: { name: string; exact_match: boolean }) {
    // TODO: Implementation with Neo4j query
    const output = {
      classes: [] as z.infer<typeof ClassInfoSchema>[],
      count: 0,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };
  }

  /**
   * Tool Handler: get_dependencies
   */
  private async handleGetDependencies(_args: {
    class_name: string;
    depth: number;
    include_external: boolean;
  }) {
    // TODO: Implementation with Neo4j query
    const output = {
      dependencies: [] as z.infer<typeof DependencySchema>[],
      count: 0,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };
  }

  /**
   * Tool Handler: get_implementations
   */
  private async handleGetImplementations(_args: {
    interface_name: string;
    include_indirect: boolean;
  }) {
    // TODO: Implementation with Neo4j query
    const output = {
      implementations: [] as z.infer<typeof ImplementationSchema>[],
      count: 0,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };
  }

  /**
   * Tool Handler: trace_calls
   */
  private async handleTraceCalls(_args: {
    function_name: string;
    class_name?: string;
    direction: 'callers' | 'callees' | 'both';
    depth: number;
  }) {
    // TODO: Implementation with Neo4j query
    const output = {
      traces: [] as z.infer<typeof CallTraceSchema>[],
      count: 0,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };
  }

  /**
   * Tool Handler: search_code
   */
  private async handleSearchCode(_args: {
    query: string;
    entity_types?: Array<'class' | 'function' | 'property' | 'interface'>;
    limit: number;
  }) {
    // TODO: Implementation with Neo4j query
    const output = {
      results: [] as z.infer<typeof SearchResultSchema>[],
      count: 0,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
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
