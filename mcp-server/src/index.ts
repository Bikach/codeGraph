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
 * Compact output formatters for token optimization
 *
 * Format convention (reduces tokens by ~70%):
 * - One line per result
 * - Pipe-separated fields
 * - Header line with count
 *
 * Examples:
 * - Class:    "class | UserService | public | /src/services/UserService.kt:45"
 * - Function: "caller:1 | AuthController.login() | /src/controllers/Auth.kt:20"
 * - Search:   "function | validateAge | UserValidator.kt:30"
 */
const formatters = {
  /**
   * Format: "type | Name | visibility | filePath:line"
   * Example: "class | UserService | public | /src/services/UserService.kt:45"
   */
  classInfo: (c: { name: string; type: string; visibility: string; filePath: string; lineNumber: number }) =>
    `${c.type} | ${c.name} | ${c.visibility} | ${c.filePath}:${c.lineNumber}`,

  /**
   * Format: "depth | Type | Name | filePath"
   * Example: "1 | class | UserRepository | /src/repos/UserRepository.kt"
   */
  dependency: (d: { name: string; type: string; depth: number; filePath?: string }) =>
    `${d.depth} | ${d.type} | ${d.name}${d.filePath ? ` | ${d.filePath}` : ''}`,

  /**
   * Format: "direct/indirect | ClassName | filePath:line"
   * Example: "direct | UserRepositoryImpl | /src/repos/UserRepositoryImpl.kt:10"
   */
  implementation: (i: { name: string; filePath: string; lineNumber: number; isDirect: boolean }) =>
    `${i.isDirect ? 'direct' : 'indirect'} | ${i.name} | ${i.filePath}:${i.lineNumber}`,

  /**
   * Format: "direction:depth | Class.function() | filePath:line"
   * Example: "caller:1 | AuthController.login() | /src/controllers/AuthController.kt:45"
   */
  callTrace: (t: { functionName: string; className?: string; filePath: string; lineNumber: number; direction: string; depth: number }) =>
    `${t.direction}:${t.depth} | ${t.className ? `${t.className}.` : ''}${t.functionName}() | ${t.filePath}:${t.lineNumber}`,

  /**
   * Format: "type | name | filePath:line"
   * Example: "function | validateUser | /src/services/UserService.kt:120"
   */
  searchResult: (r: { name: string; type: string; filePath: string; lineNumber: number }) =>
    `${r.type} | ${r.name} | ${r.filePath}:${r.lineNumber}`,
};

/**
 * Build compact text output for MCP responses
 */
function buildCompactOutput<T>(
  header: string,
  items: T[],
  formatter: (item: T) => string
): string {
  if (items.length === 0) {
    return `${header}: No results found.`;
  }
  return `${header} (${items.length}):\n${items.map(formatter).join('\n')}`;
}

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
   * Output format: "type | Name | visibility | filePath:line"
   */
  private async handleFindClass(_args: { name: string; exact_match: boolean }) {
    // TODO: Implementation with Neo4j query
    // Example query:
    // MATCH (c:Class) WHERE c.name CONTAINS $name OR c.name = $name
    // RETURN c.name, labels(c)[0] as type, c.visibility, c.filePath, c.lineNumber

    const classes: Array<{ name: string; type: string; visibility: string; filePath: string; lineNumber: number }> = [];

    const text = buildCompactOutput('CLASSES', classes, formatters.classInfo);

    return {
      content: [{ type: 'text' as const, text }],
    };
  }

  /**
   * Tool Handler: get_dependencies
   * Output format: "depth | Type | Name | filePath"
   */
  private async handleGetDependencies(_args: {
    class_name: string;
    depth: number;
    include_external: boolean;
  }) {
    // TODO: Implementation with Neo4j query
    // Example query:
    // MATCH (c:Class {name: $name})-[:USES|DEPENDS_ON*1..$depth]->(dep)
    // RETURN dep.name, labels(dep)[0] as type, length(path) as depth, dep.filePath

    const dependencies: Array<{ name: string; type: string; depth: number; filePath?: string }> = [];

    const text = buildCompactOutput('DEPENDENCIES', dependencies, formatters.dependency);

    return {
      content: [{ type: 'text' as const, text }],
    };
  }

  /**
   * Tool Handler: get_implementations
   * Output format: "direct/indirect | ClassName | filePath:line"
   */
  private async handleGetImplementations(_args: {
    interface_name: string;
    include_indirect: boolean;
  }) {
    // TODO: Implementation with Neo4j query
    // Example query:
    // MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface {name: $name})
    // RETURN c.name, c.filePath, c.lineNumber, true as isDirect

    const implementations: Array<{ name: string; filePath: string; lineNumber: number; isDirect: boolean }> = [];

    const text = buildCompactOutput('IMPLEMENTATIONS', implementations, formatters.implementation);

    return {
      content: [{ type: 'text' as const, text }],
    };
  }

  /**
   * Tool Handler: trace_calls
   * Output format: "direction:depth | Class.function() | filePath:line"
   */
  private async handleTraceCalls(_args: {
    function_name: string;
    class_name?: string;
    direction: 'callers' | 'callees' | 'both';
    depth: number;
  }) {
    // TODO: Implementation with Neo4j query
    // Example query for callers:
    // MATCH (caller:Function)-[:CALLS*1..$depth]->(f:Function {name: $name})
    // RETURN caller.name, caller.className, caller.filePath, caller.lineNumber, 'caller' as direction

    const traces: Array<{ functionName: string; className?: string; filePath: string; lineNumber: number; direction: string; depth: number }> = [];

    const text = buildCompactOutput('CALL TRACES', traces, formatters.callTrace);

    return {
      content: [{ type: 'text' as const, text }],
    };
  }

  /**
   * Tool Handler: search_code
   * Output format: "type | name | filePath:line"
   */
  private async handleSearchCode(_args: {
    query: string;
    entity_types?: Array<'class' | 'function' | 'property' | 'interface'>;
    limit: number;
  }) {
    // TODO: Implementation with Neo4j query
    // Example query:
    // MATCH (n) WHERE n.name CONTAINS $query AND labels(n)[0] IN $types
    // RETURN n.name, labels(n)[0] as type, n.filePath, n.lineNumber LIMIT $limit

    const results: Array<{ name: string; type: string; filePath: string; lineNumber: number }> = [];

    const text = buildCompactOutput('SEARCH RESULTS', results, formatters.searchResult);

    return {
      content: [{ type: 'text' as const, text }],
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
