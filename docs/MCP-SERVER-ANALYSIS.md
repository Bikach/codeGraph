# Analyse détaillée du MCP Server

Ce document décrit le fonctionnement du serveur MCP méthode par méthode.

---

## 1. Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                    CodeGraphServer                          │
├─────────────────────────────────────────────────────────────┤
│  - server: McpServer        ← SDK MCP officiel              │
│  - neo4jClient: Neo4jClient ← Client base de données        │
├─────────────────────────────────────────────────────────────┤
│  constructor()              ← Init + register tools         │
│  registerTools()            ← Enregistre les 8 outils       │
│  start()                    ← Démarre le serveur            │
│  cleanup()                  ← Ferme les connexions          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Tool Modules (tools/)                     │
├─────────────────────────────────────────────────────────────┤
│  search-nodes/     │ get-callers/      │ get-callees/       │
│  get-neighbors/    │ get-implementations/ │ get-impact/     │
│  find-path/        │ get-file-symbols/                      │
├─────────────────────────────────────────────────────────────┤
│  Chaque module contient:                                    │
│  - definition.ts  → Schéma Zod (inputSchema)                │
│  - handler.ts     → Logique métier                          │
│  - types.ts       → Types TypeScript                        │
│  - index.ts       → Re-exports                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Fichier `index.ts` - Serveur MCP Principal

### Configuration (config/config.ts)

```typescript
export const config: Config = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },
  server: {
    name: 'codegraph-server',
    version: '0.1.0',
  },
};
```

**Point clé**: Configuration via variables d'environnement avec valeurs par défaut.

---

### Constructor (index.ts)

```typescript
constructor() {
  // 1. Crée le serveur MCP
  this.server = new McpServer({
    name: config.server.name,
    version: config.server.version,
  });

  // 2. Crée le client Neo4j (pas encore connecté!)
  this.neo4jClient = new Neo4jClient(...);

  // 3. Enregistre les outils
  this.registerTools();

  // 4. Gestion d'erreurs
  this.server.server.onerror = (error) => {...};

  // 5. Graceful shutdown sur SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    await this.cleanup();
    process.exit(0);
  });
}
```

**Point clé**: `this.server.server.onerror` - le SDK MCP a un serveur sous-jacent accessible via `.server`.

---

### registerTools() - Pattern d'enregistrement

Chaque outil est enregistré avec sa définition importée depuis le module:

```typescript
import { searchNodesDefinition, handleSearchNodes } from './tools/index.js';

this.server.registerTool(
  searchNodesDefinition.name,       // 'search_nodes'
  {
    title: searchNodesDefinition.title,
    description: searchNodesDefinition.description,
    inputSchema: searchNodesDefinition.inputSchema,  // Zod schema
  },
  async ({ query, node_types, exact_match, limit }) => {
    return await handleSearchNodes(this.neo4jClient, {
      query,
      node_types,
      exact_match: exact_match ?? false,
      limit: limit ?? 20,
    });
  }
);
```

**Points clés**:
- Les définitions (Zod schemas) sont dans `tools/<name>/definition.ts`
- Les handlers sont dans `tools/<name>/handler.ts`
- `.describe()` documente chaque paramètre pour le LLM
- `.optional().default(value)` gère les valeurs par défaut

---

### Format de retour des handlers

```typescript
export async function handleSearchNodes(
  _client: Neo4jClient,
  params: SearchNodesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const results: NodeResult[] = [];

  const text = buildCompactOutput('NODES', results, formatNode);

  return {
    content: [{ type: 'text', text }],
  };
}
```

**Point clé**: Le retour contient un array `content` avec des blocs texte. Le format compact optimise les tokens.

---

### start() et cleanup()

```typescript
async start(): Promise<void> {
  // 1. Connecte à Neo4j AVANT de démarrer le serveur
  await this.neo4jClient.connect();
  console.error('Connected to Neo4j');  // stderr car stdout = MCP

  // 2. Transport stdio (communication via stdin/stdout)
  const transport = new StdioServerTransport();
  await this.server.connect(transport);
  console.error('CodeGraph MCP Server running on stdio');
}
```

**Points clés**:
- `console.error` et pas `console.log` car stdout est réservé au protocole MCP
- `StdioServerTransport` = communication JSON-RPC via stdin/stdout

---

## 3. Structure d'un module d'outil

Exemple avec `search-nodes/`:

### definition.ts
```typescript
import { z } from 'zod';

export const searchNodesDefinition = {
  name: 'search_nodes',
  title: 'Search Nodes',
  description: 'Search for nodes by name or pattern...',
  inputSchema: {
    query: z.string().describe('Search query'),
    node_types: z.array(z.enum([...])).optional(),
    exact_match: z.boolean().optional().default(false),
    limit: z.number().min(1).max(100).optional().default(20),
  },
};
```

### types.ts
```typescript
export type SearchNodesParams = {
  query: string;
  node_types?: Array<'class' | 'interface' | 'function' | 'property' | 'object'>;
  exact_match?: boolean;
  limit?: number;
};

export type NodeResult = {
  name: string;
  type: string;
  visibility: string;
  filePath: string;
  lineNumber: number;
};
```

### handler.ts
```typescript
import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { SearchNodesParams, NodeResult } from './types.js';

const formatNode = (n: NodeResult) =>
  `${n.type} | ${n.name} | ${n.visibility} | ${n.filePath}:${n.lineNumber}`;

export async function handleSearchNodes(
  _client: Neo4jClient,
  params: SearchNodesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // TODO: Implement Neo4j query
  const results: NodeResult[] = [];
  const text = buildCompactOutput('NODES', results, formatNode);
  return { content: [{ type: 'text', text }] };
}
```

### index.ts
```typescript
export { searchNodesDefinition } from './definition.js';
export { handleSearchNodes } from './handler.js';
export type { SearchNodesParams, NodeResult } from './types.js';
```

---

## 4. Fichier `neo4j.ts` - Client Neo4j

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                      Neo4jClient                            │
├─────────────────────────────────────────────────────────────┤
│  - driver: Driver | null   ← Driver Neo4j officiel          │
│  - uri, user, password     ← Credentials                    │
├─────────────────────────────────────────────────────────────┤
│  connect()                 ← Ouvre la connexion             │
│  close()                   ← Ferme la connexion             │
│  query<T>()                ← Requête READ                   │
│  write<T>()                ← Requête WRITE                  │
│  execute<T>()              ← Requête avec routing explicite │
│  readTransaction<T>()      ← Transaction READ multi-query   │
│  writeTransaction<T>()     ← Transaction WRITE multi-query  │
│  recordToObject<T>()       ← Conversion Record → Object     │
│  convertValue()            ← Conversion types Neo4j → JS    │
└─────────────────────────────────────────────────────────────┘
```

---

### Méthodes principales

#### connect()

```typescript
async connect(): Promise<void> {
  this.driver = neo4j.driver(
    this.uri,
    neo4j.auth.basic(this.user, this.password),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
      disableLosslessIntegers: true,  // Integer → number JS
      maxTransactionRetryTime: 30000,
      connectionTimeout: 30000,
    }
  );
  await this.driver.verifyConnectivity();
}
```

**Point clé**: `disableLosslessIntegers: true` convertit les Integer Neo4j en `number` JS.

#### query() vs write()

| Méthode | Routing | Usage |
|---------|---------|-------|
| `query<T>()` | READ | SELECT, MATCH (lecture) |
| `write<T>()` | WRITE | CREATE, UPDATE, DELETE |

#### convertValue() - Conversion des types Neo4j

| Type Neo4j | Conversion JS |
|------------|---------------|
| `Node` | `{ elementId, labels, properties }` |
| `Relationship` | `{ elementId, type, startNodeElementId, endNodeElementId, properties }` |
| `Path` | `{ start, end, segments: [...] }` |
| `Integer` | `number` |
| `DateTime/Date/Time` | `string` ISO |

---

## 5. Flux d'exécution complet

```
┌─────────────┐     stdin      ┌─────────────┐    Cypher    ┌─────────┐
│   Claude    │ ──────────────▶│  MCP Server │ ────────────▶│  Neo4j  │
│    Code     │                │  (index.ts) │              │         │
│             │◀────────────── │             │◀──────────── │         │
└─────────────┘     stdout     └─────────────┘   Results    └─────────┘

Requête MCP:                   Traitement:
{                              1. Valide inputSchema (Zod)
  "method": "tools/call",      2. Appelle handler
  "params": {                  3. Query Neo4j (TODO)
    "name": "search_nodes",    4. Format compact output
    "arguments": {             5. Retourne content[]
      "query": "User"
    }
  }
}
```

---

## 6. Liste des outils MCP

| Outil | Description |
|-------|-------------|
| `search_nodes` | Recherche de nœuds par nom/pattern |
| `get_callers` | Fonctions qui appellent une fonction |
| `get_callees` | Fonctions appelées par une fonction |
| `get_neighbors` | Dépendances et dépendants d'une classe |
| `get_implementations` | Implémentations d'une interface |
| `get_impact` | Analyse d'impact d'une modification |
| `find_path` | Chemin le plus court entre deux nœuds |
| `get_file_symbols` | Symboles définis dans un fichier |

**État actuel**: Tous les handlers retournent des données vides - les requêtes Cypher sont TODO.

---

## 7. Résumé des imports clés

```typescript
// MCP SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Validation
import { z } from 'zod';

// Neo4j
import neo4j, { Driver, ManagedTransaction } from 'neo4j-driver';

// Tools
import {
  searchNodesDefinition, handleSearchNodes,
  getCallersDefinition, handleGetCallers,
  // ... autres outils
} from './tools/index.js';
```
