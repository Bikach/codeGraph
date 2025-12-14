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
│       ├── index.ts      # Entry point, MCP server with tool handlers
│       ├── neo4j.ts      # Neo4j client wrapper (modern executeQuery API)
│       └── tools/        # Tool implementations (TODO)
├── docs/
│   └── SCHEMA.md         # Neo4j schema for Kotlin code analysis
└── docker-compose.yml    # Neo4j 5 Community container
```

### MCP Server Structure

- **CodeGraphServer class** (`index.ts`): Main server using `@modelcontextprotocol/sdk`. Registers 5 tools with Zod schemas for input/output validation.
- **Neo4jClient class** (`neo4j.ts`): Wrapper around `neo4j-driver` with:
  - `query()`: Read-only queries with automatic routing
  - `write()`: Write queries
  - `execute()`: Queries with explicit routing control
  - `readTransaction()`/`writeTransaction()`: Multi-query transactions
  - Automatic conversion of Neo4j types (Node, Relationship, Path, Integer) to JS objects

### MCP Tools

| Tool | Purpose |
|------|---------|
| `find_class` | Search class/interface by name (exact or partial match) |
| `get_dependencies` | List class dependencies with configurable depth (1-5) |
| `get_implementations` | Find interface implementations (direct or indirect) |
| `trace_calls` | Trace function callers/callees with configurable depth |
| `search_code` | Full-text search across classes, functions, properties |

Tool handlers in `index.ts` return stub data - Cypher query implementations are TODO.

### Output Format Convention

All tool outputs use a **compact text format** to minimize token usage (~70% reduction vs JSON):

```
HEADER (count):
field1 | field2 | field3
field1 | field2 | field3
```

| Tool | Format |
|------|--------|
| `find_class` | `type \| Name \| visibility \| filePath:line` |
| `get_dependencies` | `depth \| Type \| Name \| filePath` |
| `get_implementations` | `direct/indirect \| ClassName \| filePath:line` |
| `trace_calls` | `direction:depth \| Class.function() \| filePath:line` |
| `search_code` | `type \| name \| filePath:line` |

Example output:
```
CLASSES (3):
class | UserService | public | /src/services/UserService.kt:10
interface | Repository | public | /src/domain/Repository.kt:5
class | UserRepositoryImpl | internal | /src/infra/UserRepositoryImpl.kt:15
```

Formatters are defined in `formatters` object and `buildCompactOutput()` helper in `index.ts`.

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
- Node.js >= 18
