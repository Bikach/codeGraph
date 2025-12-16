# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeGraph is an MCP (Model Context Protocol) server that exposes a Neo4j code graph to LLMs for Kotlin code analysis and navigation. It enables intelligent codebase exploration including class search, dependency analysis, interface implementation discovery, function call tracing, and full-text code search.

## Commands

### MCP Server (mcp-server/)

```bash
# Install dependencies
cd mcp-server && npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type checking
npm run typecheck
```

### Neo4j (Docker)

```bash
# Start Neo4j
docker-compose up -d

# Stop Neo4j
docker-compose down

# Stop and remove data
docker-compose down -v

# Check logs
docker-compose logs -f neo4j
```

Access Neo4j Browser at http://localhost:7474 (Bolt: bolt://localhost:7687). Auth is disabled for dev (`NEO4J_AUTH=none`).

## Architecture

```
codegraph/
├── mcp-server/           # TypeScript MCP server
│   └── src/
│       ├── index.ts      # Entry point, MCP server with tool registration
│       ├── config/
│       │   ├── config.ts       # Server configuration from env vars
│       │   └── config.types.ts # Configuration type definitions
│       ├── neo4j/
│       │   ├── neo4j.ts        # Neo4j client wrapper (modern executeQuery API)
│       │   └── neo4j.types.ts  # Neo4j type definitions
│       ├── indexer/            # Multi-language code indexer (171 tests)
│       │   ├── index.ts        # Module exports
│       │   ├── types.ts        # Common types (ParsedFile, LanguageParser, etc.)
│       │   ├── parsers/
│       │   │   ├── registry.ts # Parser registry with dynamic imports
│       │   │   └── kotlin/     # Kotlin parser (tree-sitter based, 123 tests)
│       │   │       ├── parser.ts     # Tree-sitter initialization
│       │   │       ├── extractor.ts  # AST extraction (~1350 lines)
│       │   │       └── index.ts      # LanguageParser implementation
│       │   ├── resolver/       # Symbol resolution (48 tests) ✅
│       │   │   ├── types.ts    # Symbol, SymbolTable, ResolutionContext
│       │   │   └── index.ts    # Resolution logic
│       │   └── writer.ts       # Neo4j batch writer (TODO)
│       └── tools/
│           ├── <tool-name>/    # One directory per tool (e.g., search-nodes/)
│           │   ├── definition.ts  # Zod schema for input validation
│           │   ├── handler.ts     # Handler function implementation
│           │   ├── types.ts       # TypeScript type definitions
│           │   └── index.ts       # Module re-exports
│           ├── formatters.ts   # Compact output formatters for token optimization
│           └── index.ts        # Re-exports all tools
├── docs/
│   ├── SCHEMA.md         # Neo4j schema for Kotlin code analysis
│   └── PLAN-INDEXER.md   # Implementation plan for the indexer
└── docker-compose.yml    # Neo4j 5 Community container
```

### MCP Server Structure

- **CodeGraphServer class** (`index.ts`): Main server using `@modelcontextprotocol/sdk`. Registers tools with Zod schemas for input validation.
- **Configuration** (`config/`): Server configuration from environment variables
- **Neo4jClient class** (`neo4j/neo4j.ts`): Wrapper around `neo4j-driver` with read/write queries, transactions, and automatic type conversion
- **Tool modules** (`tools/<tool-name>/`): Each tool is a self-contained module with definition, handler, and types
- **Formatters** (`tools/formatters.ts`): Compact output formatters for token optimization

### Indexer Module (`indexer/`)

Multi-language code indexer that parses source files and populates the Neo4j graph. **Status: 171 tests passing.**

**Architecture**:
- **Modular parsers**: Each language has its own parser in `parsers/<language>/`
- **Registry pattern**: `parsers/registry.ts` maps file extensions to parsers with lazy loading
- **Resolver**: `resolver/` resolves cross-file symbol references (buildSymbolTable, resolveSymbols)
- **Writer**: `writer.ts` writes to Neo4j (TODO)

**Key types** (`types.ts`):
- `LanguageParser`: Interface all parsers must implement
- `ParsedFile`: Normalized output from any parser (classes, functions, imports, etc.)
- `ResolvedFile`: ParsedFile with resolved cross-references
- `ParsedCall`: Function call with receiver, arguments, safe call detection

**Resolver exports** (`resolver/`):
- `buildSymbolTable(files)`: Build a global symbol table from parsed files
- `resolveSymbols(files, table?)`: Resolve all calls to their target FQNs
- `lookupSymbol(table, fqn)`: Find a symbol by fully qualified name
- `findSymbols(table, pattern)`: Find symbols matching a pattern (glob-style)
- `getResolutionStats(resolved)`: Get resolution statistics

**Kotlin Parser features** (`parsers/kotlin/`):
- Classes, interfaces, objects, enums, annotations (data, sealed, abstract)
- Functions (extension, suspend, inline, infix, operator)
- Generics with bounds, variance, reified, where clause
- Primary/secondary constructors
- Companion objects
- Type aliases, destructuring declarations
- Function calls extraction (chained, nested, safe calls, qualified)

**Adding a new language**:
1. Create `parsers/<language>/` with `parser.ts`, `extractor.ts`, `index.ts`
2. Implement `LanguageParser` interface
3. Register in `registry.ts`

### MCP Tools

| Tool | Purpose |
|------|---------|
| `search_nodes` | Search nodes (classes, interfaces, functions) by name or pattern |
| `get_callers` | Find all functions that call a specified function |
| `get_callees` | Find all functions called by a specified function |
| `get_neighbors` | Get dependencies and dependents of a class/interface |
| `get_implementations` | Find interface implementations (direct or indirect) |
| `get_impact` | Analyze impact of modifying a node |
| `find_path` | Find shortest path between two nodes |
| `get_file_symbols` | List all symbols defined in a file |

Tool handlers return stub data - Cypher query implementations are TODO.

### Output Format Convention

All tool outputs use a **compact text format** to minimize token usage (~70% reduction vs JSON):

```
HEADER (count):
field1 | field2 | field3
field1 | field2 | field3
```

Example output:
```
NODES (3):
class | UserService | public | /src/services/UserService.kt:10
interface | Repository | public | /src/domain/Repository.kt:5
class | UserRepositoryImpl | internal | /src/infra/UserRepositoryImpl.kt:15
```

Formatters are defined in `tools/formatters.ts` (`buildCompactOutput()` helper).

### Neo4j Schema (Kotlin-focused)

**Nodes**: Package, Class, Interface, Object, Function, Property, Parameter, Annotation

**Key Relationships**:
- `CONTAINS`: Package → Class/Interface/Object
- `DECLARES`: Class/Interface/Object → Function/Property
- `EXTENDS`: Class → Class
- `IMPLEMENTS`: Class → Interface
- `CALLS`: Function → Function
- `USES`: Function → Class/Interface

See `docs/SCHEMA.md` for complete schema with Cypher examples.

## Configuration

Create `mcp-server/.env`:
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password  # Empty if NEO4J_AUTH=none
```

### Claude Desktop Integration

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["/path/to/codegraph/mcp-server/dist/index.js"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": ""
      }
    }
  }
}
```

## Tech Stack

- TypeScript (ES2022, NodeNext modules, strict mode)
- `@modelcontextprotocol/sdk` ^1.24.3
- `neo4j-driver` ^5.28.1
- `zod` for schema validation
- `tree-sitter` + `tree-sitter-kotlin` for parsing
- `vitest` for testing
- Node.js >= 18

## Testing

```bash
# Run all tests
cd mcp-server && npm test

# Run tests in watch mode
npm run test:watch
```

**Test counts:**
- Parser Kotlin: 123 tests
- Resolver: 48 tests
- Total: 171 tests (342 with dist/)
