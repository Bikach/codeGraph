# Analyse détaillée du MCP Server

Ce document décrit le fonctionnement du serveur MCP méthode par méthode.

---

## 1. Fichier `index.ts` - Serveur MCP Principal

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    CodeGraphServer                          │
├─────────────────────────────────────────────────────────────┤
│  - server: McpServer        ← SDK MCP officiel              │
│  - neo4jClient: Neo4jClient ← Client base de données        │
├─────────────────────────────────────────────────────────────┤
│  constructor()              ← Init + register tools         │
│  registerTools()            ← Déclare les 5 outils          │
│  handleFindClass()          ← Handler (TODO)                │
│  handleGetDependencies()    ← Handler (TODO)                │
│  handleGetImplementations() ← Handler (TODO)                │
│  handleTraceCalls()         ← Handler (TODO)                │
│  handleSearchCode()         ← Handler (TODO)                │
│  start()                    ← Démarre le serveur            │
│  cleanup()                  ← Ferme les connexions          │
└─────────────────────────────────────────────────────────────┘
```

### Points importants

#### 1. Configuration (lignes 22-33)

```typescript
const config = {
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

#### 2. Schémas Zod (lignes 38-76)

5 schémas définissent la structure des réponses :

| Schéma | Usage | Champs clés |
|--------|-------|-------------|
| `ClassInfoSchema` | Résultat de `find_class` | name, type, filePath, lineNumber, visibility |
| `DependencySchema` | Résultat de `get_dependencies` | name, type, depth, filePath |
| `ImplementationSchema` | Résultat de `get_implementations` | name, filePath, isDirect |
| `CallTraceSchema` | Résultat de `trace_calls` | functionName, className, direction, depth |
| `SearchResultSchema` | Résultat de `search_code` | name, type, filePath, snippet |

**Point clé**: Zod valide automatiquement les entrées/sorties et génère la doc pour le LLM.

---

#### 3. Constructor (lignes 85-111)

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

#### 4. registerTools() - Pattern d'enregistrement (lignes 116-286)

Chaque outil suit ce pattern :

```typescript
this.server.registerTool(
  'tool_name',                    // 1. Nom de l'outil
  {
    title: 'Human Title',         // 2. Titre lisible
    description: '...',           // 3. Description pour le LLM
    inputSchema: {                // 4. Schéma d'entrée Zod
      param: z.string().describe('...'),
      optional_param: z.boolean().optional().default(false),
    },
    outputSchema: {               // 5. Schéma de sortie Zod
      results: z.array(...),
      count: z.number(),
    },
  },
  async (args) => {               // 6. Handler async
    return await this.handleXxx(args);
  }
);
```

**Points clés**:
- `inputSchema` utilise des objets Zod directement (pas de JSON Schema)
- `.describe()` documente chaque paramètre pour le LLM
- `.optional().default(value)` gère les valeurs par défaut
- Les handlers retournent un format spécifique (voir ci-dessous)

---

#### 5. Format de retour des handlers (lignes 291-407)

```typescript
private async handleFindClass(_args: { name: string; exact_match: boolean }) {
  const output = {
    classes: [] as z.infer<typeof ClassInfoSchema>[],
    count: 0,
  };

  return {
    content: [
      {
        type: 'text' as const,    // Contenu texte pour le LLM
        text: JSON.stringify(output, null, 2),
      },
    ],
    structuredContent: output,    // Données structurées validées par outputSchema
  };
}
```

**Point clé**: Le retour contient :
- `content`: Array de blocs (texte, images, etc.) pour le LLM
- `structuredContent`: Données typées correspondant à `outputSchema`

**État actuel**: Tous les handlers retournent des données vides - les requêtes Cypher sont TODO.

---

#### 6. start() et cleanup() (lignes 412-429)

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

#### 7. Point d'entrée (lignes 435-443)

```typescript
async function main() {
  const server = new CodeGraphServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Point clé**: Gestion globale des erreurs avec exit code 1.

---

## 2. Fichier `neo4j.ts` - Client Neo4j

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
│  isConnected()             ← Check état connexion           │
│  static routing            ← Expose neo4j.routing           │
└─────────────────────────────────────────────────────────────┘
```

---

### Méthodes détaillées

#### 1. connect() (lignes 57-73)

```typescript
async connect(): Promise<void> {
  this.driver = neo4j.driver(
    this.uri,
    neo4j.auth.basic(this.user, this.password),
    {
      maxConnectionPoolSize: 50,           // Pool de 50 connexions
      connectionAcquisitionTimeout: 30000, // 30s pour obtenir une connexion
      disableLosslessIntegers: true,       // IMPORTANT: Integer → number JS
      maxTransactionRetryTime: 30000,      // 30s de retry sur erreur
      connectionTimeout: 30000,            // 30s timeout connexion
    }
  );
  await this.driver.verifyConnectivity();  // Test la connexion
}
```

**Points clés**:
- `disableLosslessIntegers: true` → Les Integer Neo4j deviennent des `number` JS (sinon c'est un objet complexe)
- `verifyConnectivity()` échoue si Neo4j est inaccessible

---

#### 2. query() vs write() (lignes 99-159)

| Méthode | Routing | Usage |
|---------|---------|-------|
| `query<T>()` | `neo4j.routing.READ` | SELECT, MATCH (lecture) |
| `write<T>()` | `neo4j.routing.WRITE` | CREATE, UPDATE, DELETE |

```typescript
// Exemple query
const results = await client.query<{ c: ClassNode }>(
  'MATCH (c:Class {name: $name}) RETURN c',
  { name: 'MyClass' }
);

// Exemple write
await client.write(
  'CREATE (c:Class {name: $name})',
  { name: 'NewClass' }
);
```

**Point clé**: Le routing est important pour les clusters Neo4j (lecture sur replicas, écriture sur leader).

---

#### 3. execute() (lignes 177-206)

```typescript
async execute<T>(
  cypher: string,
  parameters: {},
  routing: RoutingControl,     // READ ou WRITE
  options: QueryOptions
): Promise<{ records: T[]; summary: {...} }>
```

**Différence avec query/write**: Retourne aussi un `summary` avec :
- `counters`: Nombre de nodes/relations créés/supprimés
- `queryType`: Type de requête ("r", "w", "rw", etc.)

---

#### 4. Transactions (lignes 223-276)

```typescript
// Transaction READ - plusieurs requêtes atomiques en lecture
const result = await client.readTransaction(async (tx) => {
  const classes = await tx.run('MATCH (c:Class) RETURN c');
  const interfaces = await tx.run('MATCH (i:Interface) RETURN i');
  return { classes, interfaces };  // Tout ou rien
});

// Transaction WRITE - plusieurs requêtes atomiques en écriture
await client.writeTransaction(async (tx) => {
  await tx.run('CREATE (a:Class {name: "A"})');
  await tx.run('CREATE (b:Class {name: "B"})');
  await tx.run('MATCH (a:Class {name: "A"}), (b:Class {name: "B"}) CREATE (a)-[:DEPENDS_ON]->(b)');
});  // Rollback automatique si erreur
```

**Point clé**: Utilisez les transactions quand vous avez plusieurs requêtes qui doivent réussir ensemble.

---

#### 5. convertValue() - Conversion des types Neo4j (lignes 301-366)

Cette méthode est **cruciale** car Neo4j retourne des types spéciaux :

| Type Neo4j | Conversion JS |
|------------|---------------|
| `Node` | `{ elementId, labels, properties }` |
| `Relationship` | `{ elementId, type, startNodeElementId, endNodeElementId, properties }` |
| `Path` | `{ start, end, segments: [...] }` |
| `Integer` | `number` (via `toNumber()`) |
| `DateTime/Date/Time` | `string` ISO |
| `Array` | Conversion récursive |
| `Object` | Conversion récursive |

**Point clé**: Sans cette conversion, les types Neo4j ne sont pas sérialisables en JSON.

---

## 3. Flux d'exécution complet

```
┌─────────────┐     stdin      ┌─────────────┐    Cypher    ┌─────────┐
│   Claude    │ ──────────────▶│  MCP Server │ ────────────▶│  Neo4j  │
│    Code     │                │  (index.ts) │              │         │
│             │◀────────────── │             │◀──────────── │         │
└─────────────┘     stdout     └─────────────┘   Results    └─────────┘
        │                             │
        │  JSON-RPC via stdio         │
        │  (MCP Protocol)             │
        ▼                             ▼
   Requête:                     Traitement:
   {                            1. Valide avec Zod
     "method": "tools/call",    2. Exécute handler
     "params": {                3. Query Neo4j
       "name": "find_class",    4. Convertit résultats
       "arguments": {           5. Retourne JSON
         "name": "User"
       }
     }
   }
```

---

## 4. Ce qui reste à implémenter (TODO)

Les 5 handlers dans `index.ts` retournent des données vides. Il faut :

1. **handleFindClass**: Requête Cypher pour chercher Class/Interface par nom
2. **handleGetDependencies**: Requête avec `*1..depth` pour parcourir les relations USES/DEPENDS
3. **handleGetImplementations**: Requête `[:IMPLEMENTS]` avec optionnel `[:EXTENDS*]`
4. **handleTraceCalls**: Requête `[:CALLS*1..depth]` bidirectionnelle
5. **handleSearchCode**: Requête avec `CONTAINS` ou full-text index

Le schéma Cypher est documenté dans `docs/SCHEMA.md` avec des exemples de requêtes.

---

## 5. Résumé des imports clés

```typescript
// MCP SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Validation
import { z } from 'zod';

// Neo4j
import neo4j, {
  Driver,
  ManagedTransaction,
  Record as Neo4jRecord,
  Neo4jError,
  RoutingControl,
} from 'neo4j-driver';
```
