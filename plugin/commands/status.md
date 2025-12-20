---
description: Show Neo4j status and graph statistics
---

# Status Command

Show Neo4j status and graph statistics.

## Action

Execute the following command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/status.sh"
```

## Interpretation

- If Neo4j is not connected: suggest running `/codegraph:setup`
- If the graph is empty: suggest running `/codegraph:index`
- Otherwise: display graph statistics to the user
