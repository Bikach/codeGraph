---
description: Index the current project into Neo4j graph
---

# Index Command

Index the current project into Neo4j.

## Action

Execute the following command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/index-project.sh" $ARGUMENTS
```

If no arguments provided, use `.` as the default path.

## Options

The user can specify options:
- `/codegraph:index --clear` : Clear database before indexing
- `/codegraph:index --exclude-tests` : Exclude test files
- `/codegraph:index /path/to/project` : Index a specific project

## After indexing

Show the indexing summary to the user and suggest exploring the graph with MCP tools (search_nodes, get_callers, etc.).
