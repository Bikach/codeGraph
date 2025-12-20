---
description: Start Neo4j and prepare the database for CodeGraph
---

# Setup Command

Start Neo4j for CodeGraph.

## Action

Execute the following command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
```

## On error

- If Docker is not installed: ask the user to install Docker Desktop
- If Docker is not running: ask the user to start Docker
- If the container fails to start: show logs with `docker compose logs neo4j`
