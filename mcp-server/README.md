# CodeGraph MCP Server

MCP (Model Context Protocol) server that exposes a Neo4j code graph to LLMs for Kotlin code analysis and navigation.

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point, main MCP server
│   ├── config/
│   │   ├── config.ts         # Server configuration from env vars
│   │   └── config.types.ts   # Configuration type definitions
│   ├── neo4j/
│   │   ├── neo4j.ts          # Neo4j client with helpers
│   │   └── neo4j.types.ts    # Neo4j type definitions
│   ├── indexer/              # Multi-language code indexer (171 tests)
│   │   ├── index.ts          # Module exports
│   │   ├── types.ts          # Common types (ParsedFile, LanguageParser, etc.)
│   │   ├── parsers/
│   │   │   ├── registry.ts   # Parser registry with dynamic imports
│   │   │   └── kotlin/       # Kotlin parser (tree-sitter based, 123 tests)
│   │   ├── resolver/         # Symbol resolution (48 tests)
│   │   └── writer.ts         # Neo4j batch writer (TODO)
│   └── tools/
│       ├── index.ts          # Tool handlers implementation
│       └── formatters.ts     # Compact output formatters
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file at the project root:

```bash
cp .env.example .env
```

Then fill in the variables:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

## Usage

### Development

```bash
# Watch mode with auto-reload
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

### With Claude Desktop

Add the configuration in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["/path/to/codegraph/mcp-server/dist/index.js"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "your-password"
      }
    }
  }
}
```

## Indexer Module

The indexer parses Kotlin source files and resolves cross-file symbol references.

### Supported Kotlin Features

| Category | Features |
|----------|----------|
| **Classes** | class, interface, object, enum, annotation, data, sealed, abstract |
| **Members** | functions, properties, companion objects, nested classes |
| **Constructors** | primary (with val/var properties), secondary |
| **Generics** | type parameters, bounds, variance (in/out), reified, where clause |
| **Functions** | extension, suspend, inline, infix, operator |
| **Lambda** | function types, receiver types, crossinline, noinline |
| **Calls** | chained calls, nested calls, safe calls (?.), qualified calls (FQN) |
| **Other** | imports, annotations with arguments, type aliases, destructuring |

### Programmatic Usage

```typescript
import { kotlinParser } from './indexer/parsers/kotlin/index.js';
import { buildSymbolTable, resolveSymbols, getResolutionStats } from './indexer/index.js';

// Parse Kotlin files
const file1 = await kotlinParser.parse(sourceCode1, '/path/to/File1.kt');
const file2 = await kotlinParser.parse(sourceCode2, '/path/to/File2.kt');

// Build symbol table and resolve calls
const symbolTable = buildSymbolTable([file1, file2]);
const resolved = resolveSymbols([file1, file2], symbolTable);

// Get resolution statistics
const stats = getResolutionStats(resolved);
console.log(`Resolution rate: ${stats.resolutionRate * 100}%`);
```

### Tests

```bash
# Run all tests (171 tests)
npm test

# Parser tests: 123 tests
# Resolver tests: 48 tests
```

## Available MCP Tools

### 1. `search_nodes`

Search for classes, interfaces, or functions by name.

**Parameters:**
- `name` (string, required): Name to search
- `exact_match` (boolean, optional): Exact or partial search

### 2. `get_callers`

Find all functions that call a specified function.

**Parameters:**
- `function_name` (string, required): Function name
- `class_name` (string, optional): Class name

### 3. `get_callees`

Find all functions called by a specified function.

**Parameters:**
- `function_name` (string, required): Function name
- `class_name` (string, optional): Class name

### 4. `get_neighbors`

Get dependencies and dependents of a class/interface.

**Parameters:**
- `name` (string, required): Class or interface name
- `depth` (number, optional): Depth (1-5, default: 1)

### 5. `get_implementations`

Find implementations of an interface.

**Parameters:**
- `interface_name` (string, required): Interface name
- `include_indirect` (boolean, optional): Include indirect implementations

### 6. `get_impact`

Analyze impact of modifying a node.

**Parameters:**
- `name` (string, required): Node name
- `depth` (number, optional): Analysis depth

### 7. `find_path`

Find shortest path between two nodes.

**Parameters:**
- `from` (string, required): Source node
- `to` (string, required): Target node

### 8. `get_file_symbols`

List all symbols defined in a file.

**Parameters:**
- `file_path` (string, required): File path

## Neo4j Data Model

The code graph contains the following nodes:

- **Package**: Kotlin package
- **Class**: Class (data, sealed, abstract)
- **Interface**: Kotlin interface
- **Object**: Singleton or companion object
- **Function**: Function or method
- **Property**: Class or top-level property
- **Parameter**: Function parameter
- **Annotation**: Kotlin annotation

And relationships:

- `CONTAINS`: Package → Class/Interface/Object
- `DECLARES`: Class/Interface/Object → Function/Property
- `EXTENDS`: Class → Class (inheritance)
- `IMPLEMENTS`: Class → Interface
- `CALLS`: Function → Function
- `USES`: Function → Class/Interface
- `HAS_PARAMETER`: Function → Parameter
- `ANNOTATED_WITH`: Element → Annotation
- `RETURNS`: Function → Class/Interface

See `docs/SCHEMA.md` for complete schema with Cypher examples.

## Development

### Code Structure

- **src/index.ts**: Main MCP server with tool registration
- **src/config/**: Configuration module
- **src/neo4j/**: Neo4j client module
- **src/indexer/**: Code indexer module
  - `types.ts`: Common types for all parsers
  - `parsers/`: Language-specific parsers
  - `resolver/`: Symbol resolution logic
  - `writer.ts`: Neo4j batch writer (TODO)
- **src/tools/**: MCP tool handlers

### Next Steps

1. ~~Implement Kotlin parser~~ ✅ DONE (123 tests)
2. ~~Implement symbol resolver~~ ✅ DONE (48 tests)
3. Implement Neo4j batch writer
4. Implement CLI `codegraph-indexer`
5. Implement MCP tool `index_codebase`

### Code Conventions

- TypeScript strict mode enabled
- JSDoc comments for public functions
- Explicit error handling
- Unit tests for all modules

## License

MIT
