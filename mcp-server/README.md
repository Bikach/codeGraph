# CodeGraph MCP Server

MCP (Model Context Protocol) server that exposes a Neo4j code graph to LLMs for code analysis and navigation.

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

## Available Tools

### 1. `find_class`

Search for a class or interface by name.

**Parameters:**
- `name` (string, required): Class name
- `exact_match` (boolean, optional): Exact or partial search

**Example:**
```typescript
{
  "name": "UserService",
  "exact_match": true
}
```

### 2. `get_dependencies`

List dependencies of a class.

**Parameters:**
- `class_name` (string, required): Class name
- `depth` (number, optional): Depth (1-5, default: 1)
- `include_external` (boolean, optional): Include npm dependencies

**Example:**
```typescript
{
  "class_name": "UserService",
  "depth": 2,
  "include_external": false
}
```

### 3. `get_implementations`

Find implementations of an interface.

**Parameters:**
- `interface_name` (string, required): Interface name
- `include_indirect` (boolean, optional): Include indirect implementations

**Example:**
```typescript
{
  "interface_name": "IRepository",
  "include_indirect": true
}
```

### 4. `trace_calls`

Trace function calls.

**Parameters:**
- `function_name` (string, required): Function name
- `class_name` (string, optional): Class name
- `direction` (string, optional): "callers", "callees", or "both"
- `depth` (number, optional): Depth (1-5, default: 2)

**Example:**
```typescript
{
  "function_name": "authenticate",
  "direction": "both",
  "depth": 2
}
```

### 5. `search_code`

Full-text search in code.

**Parameters:**
- `query` (string, required): Search term
- `entity_types` (array, optional): Entity types ["class", "function", "property", "interface"]
- `limit` (number, optional): Max results (1-100, default: 20)

**Example:**
```typescript
{
  "query": "authentication",
  "entity_types": ["class", "function"],
  "limit": 10
}
```

## Development

### Code Structure

- **src/index.ts**: Main MCP server with tool registration
- **src/config/**: Configuration module
  - `config.ts`: Server configuration from environment variables
  - `config.types.ts`: TypeScript interfaces (Neo4jConfig, ServerConfig, Config)
- **src/neo4j/**: Neo4j client module
  - `neo4j.ts`: Neo4j client with simplified API
  - `neo4j.types.ts`: TypeScript types (QueryOptions, ResultRecord)
- **src/tools/**: Tool handlers module
  - `index.ts`: Handler functions for each MCP tool
  - `formatters.ts`: Compact output formatters for token optimization

### Next Steps

1. Implement tool handlers in `src/tools/`
2. Create optimized Cypher queries for each operation
3. Add unit tests
4. Add input schema validation
5. Implement caching for frequent queries
6. Add metrics and monitoring

### Code Conventions

- TypeScript strict mode enabled
- JSDoc comments for public functions
- Explicit error handling
- User input validation

## Neo4j Data Model

The code graph contains the following nodes:

- **Class**: Class or interface
- **Function**: Function or method
- **Property**: Class property
- **File**: Source file

And relationships:

- `DEPENDS_ON`: Dependency between classes
- `IMPLEMENTS`: Interface implementation
- `EXTENDS`: Inheritance
- `CALLS`: Function call
- `CONTAINS`: File contents
- `HAS_PROPERTY`: Class property
- `HAS_METHOD`: Class method

## License

MIT
