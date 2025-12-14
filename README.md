# CodeGraph - Docker Setup

## Quick Start

### Start Neo4j

```bash
docker-compose up -d
```

### Stop Neo4j

```bash
docker-compose down
```

### Stop and remove data

```bash
docker-compose down -v
```

### Check logs

```bash
docker-compose logs -f neo4j
```

## Access

- **Neo4j Browser**: http://localhost:7474
- **Bolt Protocol**: bolt://localhost:7687

## Configuration

Authentication is disabled for development (`NEO4J_AUTH=none`).

To customize the configuration, copy `.env.example` to `.env` and modify the values.
