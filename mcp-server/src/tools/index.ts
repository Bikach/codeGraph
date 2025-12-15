/**
 * Tool Handlers for CodeGraph MCP Server
 *
 * Re-exports all tools from their respective modules.
 * Each tool is organized in its own directory with:
 * - definition.ts: Zod schema and type definitions
 * - handler.ts: Handler function implementation
 * - index.ts: Module exports
 */

// Search and discovery
export { searchNodesDefinition, handleSearchNodes, type SearchNodesParams } from './search-nodes/index.js';

// Call graph analysis
export { getCallersDefinition, handleGetCallers, type GetCallersParams } from './get-callers/index.js';
export { getCalleesDefinition, handleGetCallees, type GetCalleesParams } from './get-callees/index.js';

// Dependency and relationship analysis
export { getNeighborsDefinition, handleGetNeighbors, type GetNeighborsParams } from './get-neighbors/index.js';
export { getImplementationsDefinition, handleGetImplementations, type GetImplementationsParams } from './get-implementations/index.js';

// Impact and path analysis
export { getImpactDefinition, handleGetImpact, type GetImpactParams } from './get-impact/index.js';
export { findPathDefinition, handleFindPath, type FindPathParams } from './find-path/index.js';

// File analysis
export { getFileSymbolsDefinition, handleGetFileSymbols, type GetFileSymbolsParams } from './get-file-symbols/index.js';

// Shared utilities
export { formatters, buildCompactOutput } from './formatters.js';
