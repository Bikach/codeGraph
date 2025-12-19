# CodeGraph

MCP (Model Context Protocol) server that builds and exposes a code graph via Neo4j, enabling LLMs to intelligently navigate and analyze codebases.

## Why CodeGraph?

CodeGraph gives LLMs **structural understanding** of your code through a graph database, enabling:

- **Find callers/callees** - Trace function call chains across files
- **Impact analysis** - Understand what breaks when you change something
- **Implementation discovery** - Find all implementations of an interface
- **Dependency mapping** - Visualize class dependencies
- **Symbol search** - Find classes, functions, interfaces by name

See the [benchmark report](https://bikach.github.io/codeGraph/report/) comparing CodeGraph MCP tools vs native search tools.

## Quick Start

### 1. Start Neo4j

```bash
docker-compose up -d
```

Access Neo4j Browser at http://localhost:7474 (Bolt: `bolt://localhost:7687`)

### 2. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 3. Configure Claude Code

Add to your `.mcp.json` (project-level) or `~/.claude/claude.json` (global):

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["/absolute/path/to/codegraph/mcp-server/dist/index.js"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": ""
      }
    }
  }
}
```

> **Note**: Leave `NEO4J_PASSWORD` empty if using the default Docker setup (`NEO4J_AUTH=none`).

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_nodes` | Search classes, interfaces, functions by name or pattern |
| `get_callers` | Find all functions calling a specified function |
| `get_callees` | Find all functions called by a specified function |
| `get_neighbors` | Get dependencies and dependents of a class/interface |
| `get_implementations` | Find implementations of an interface |
| `get_impact` | Analyze impact of modifying a node |
| `find_path` | Find shortest path between two nodes |
| `get_file_symbols` | List all symbols defined in a file |

## Development

```bash
cd mcp-server

# Development with hot reload
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck
```

## Docker Commands

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

## License

MIT
