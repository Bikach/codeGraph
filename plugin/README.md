# CodeGraph Plugin for Claude Code

Analyze and navigate codebases through a Neo4j-backed knowledge graph.

## Supported Languages

| Language | Status |
|----------|--------|
| Kotlin | ✅ Available |
| Java | 🔜 Coming soon |
| TypeScript | 🔜 Coming soon |

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed and running
- [Claude Code](https://claude.ai/code) CLI

## Installation

In Claude Code, run:

```
/plugin install codegraph@bikach
```

## Commands

### `/codegraph:setup`

Starts Neo4j and prepares the database.

```
/codegraph:setup
```

**What it does:**
1. Checks Docker is running
2. Starts the Neo4j container
3. Waits for Neo4j to be ready
4. Creates indexes and constraints

**Result:** Neo4j available at http://localhost:7474

---

### `/codegraph:index`

Indexes a project into the Neo4j graph.

```
/codegraph:index                      # Index current project
/codegraph:index /path/to/project     # Index specific project
/codegraph:index --clear              # Clear database before indexing
/codegraph:index --exclude-tests      # Exclude test files
```

**What it does:**
1. Scans source files (.kt)
2. Parses with tree-sitter
3. Resolves cross-file symbols
4. Writes the graph to Neo4j

---

### `/codegraph:status`

Shows Neo4j status and graph statistics.

```
/codegraph:status
```

**Shows:**
- Neo4j connection status
- Node counts (classes, functions, etc.)
- Relationship counts (CALLS, IMPLEMENTS, etc.)

---

## After Indexing

Once indexed, MCP tools are available automatically:

| Tool | Description |
|------|-------------|
| `search_nodes` | Search by name or pattern |
| `get_callers` | Who calls this function? |
| `get_callees` | What functions are called? |
| `get_neighbors` | Get dependencies and dependents of a class |
| `get_implementations` | Find interface implementations |
| `get_impact` | Analyze modification impact |
| `find_path` | Find shortest path between two nodes |
| `get_file_symbols` | List all symbols in a file |
