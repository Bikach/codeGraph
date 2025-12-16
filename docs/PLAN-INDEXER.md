# Plan : Indexeur Tree-sitter Kotlin

## Objectif
Créer un indexeur Kotlin avec tree-sitter, utilisable via un **plugin Claude Code** avec deux commandes :
1. `/codegraph-setup` : Configure et démarre Neo4j via Docker
2. `/codegraph-indexer` : Indexe le projet courant dans Neo4j

## Architecture cible

**Approche Plugin Claude Code** : Distribution via marketplace GitHub, MCP server bundlé, Neo4j en Docker local.

Pourquoi ce choix :
- **Zero friction** : Installation en 2 commandes (`/plugin marketplace add`, `/plugin install`)
- **Bundling** : Tout le code JS est bundlé, pas de `npm install` chez l'user
- **Performance I/O** : L'indexeur tourne en local, pas dans Docker (volumes lents sur macOS)
- **Intégration native** : Les commandes sont directement dans Claude Code

```
codegraph/
├── mcp-server/
│   └── src/
│       ├── index.ts              # MCP server (existant)
│       ├── indexer/              # Module indexeur ✅
│       │   ├── parsers/          # Parsers par langage (modulaires) ✅
│       │   │   ├── kotlin/       # Parser Kotlin (123 tests)
│       │   │   └── registry.ts   # Registre des parsers
│       │   ├── resolver/         # Résolution des symboles (48 tests) ✅
│       │   ├── writer/           # Écriture batch Neo4j (91 tests) ✅
│       │   ├── types.ts          # Types communs
│       │   └── index.ts          # Exports
│       └── tools/
│           └── index-codebase/   # Outil MCP pour indexation
├── plugin/                       # NEW: Plugin Claude Code
│   ├── .claude-plugin/
│   │   └── plugin.json           # Manifest du plugin
│   ├── commands/
│   │   ├── codegraph-setup.md    # /codegraph-setup
│   │   └── codegraph-indexer.md  # /codegraph-indexer
│   ├── dist/                     # MCP server bundlé (esbuild)
│   │   └── index.js
│   ├── .mcp.json                 # Config MCP auto
│   └── docker-compose.yml        # Neo4j pour setup
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest
├── docker-compose.yml            # Neo4j (existant)
└── README.md
```

## Comment l'utilisateur installe CodeGraph

```bash
# 1. Ajouter le marketplace (une seule fois)
/plugin marketplace add bikach/codegraph

# 2. Installer le plugin
/plugin install codegraph@codegraph

# 3. Setup Neo4j (une seule fois par machine)
/codegraph-setup

# 4. Indexer un projet Kotlin
cd /path/to/kotlin/project
/codegraph-indexer
```

## Comment ça marche

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Machine locale                               │
│                                                                         │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │                      Claude Code                             │     │
│    │                                                              │     │
│    │   /codegraph-setup          /codegraph-indexer              │     │
│    │         │                          │                         │     │
│    │         ▼                          ▼                         │     │
│    │   Lance Docker             Appelle MCP tool                  │     │
│    │   + Neo4j                  index_codebase                    │     │
│    └─────────┬──────────────────────────┬────────────────────────┘     │
│              │                          │                               │
│              │                          ▼                               │
│              │           ┌─────────────────────────────────┐           │
│              │           │   MCP Server (bundlé)           │           │
│              │           │   plugin/dist/index.js          │           │
│              │           │                                 │           │
│              │           │  parser → resolver → writer     │           │
│              │           └───────────────┬─────────────────┘           │
│              │                           │                              │
│              └───────────────────────────┼──────────────────────────────│
│                                          │                              │
└──────────────────────────────────────────┼──────────────────────────────┘
                                           │
                                           ▼
                            ┌───────────────────────────────┐
                            │      Docker (Neo4j only)      │
                            │  ┌───────────────────────┐    │
                            │  │    Neo4j (7687)       │    │
                            │  └───────────────────────┘    │
                            └───────────────────────────────┘
```

## Étapes d'implémentation

### Étape 1 : Setup structure et types communs ✅ DONE
- [x] Créer `mcp-server/src/indexer/types.ts` avec les interfaces communes
- [x] Créer `mcp-server/src/indexer/parsers/registry.ts`

### Étape 2 : Parser Kotlin ✅ DONE (123 tests)
- [x] Parser tree-sitter-kotlin complet
- [x] Extraction de toutes les structures Kotlin

### Étape 3 : Résolveur de symboles ✅ DONE (48 tests)
- [x] Résolution cross-fichiers des appels

### Étape 4 : Writer Neo4j ✅ DONE (91 tests)
- [x] Écriture batch avec toutes les relations

### Étape 5 : Plugin Claude Code ⏳ EN COURS

#### 5.1 Structure du plugin
- [ ] Créer `plugin/.claude-plugin/plugin.json` (manifest)
- [ ] Créer `.claude-plugin/marketplace.json` (marketplace à la racine)

#### 5.2 Commande `/codegraph-setup`
- [ ] Créer `plugin/commands/codegraph-setup.md`
- [ ] Vérifie que Docker est installé
- [ ] Démarre Neo4j via docker-compose
- [ ] Vérifie la connexion à Neo4j

#### 5.3 Commande `/codegraph-indexer`
- [ ] Créer `plugin/commands/codegraph-indexer.md`
- [ ] Scanne les fichiers .kt du projet courant
- [ ] Appelle le MCP tool `index_codebase`
- [ ] Affiche le résumé de l'indexation

#### 5.4 MCP Server bundlé
- [ ] Configurer esbuild pour bundler `src/index.ts` → `plugin/dist/index.js`
- [ ] Créer `plugin/.mcp.json` avec config du server
- [ ] Ajouter script `npm run bundle` dans package.json

#### 5.5 Outil MCP `index_codebase`
- [ ] Créer `mcp-server/src/tools/index-codebase/`
- [ ] Implémente la logique d'indexation complète
- [ ] Retourne les statistiques d'indexation

### Étape 6 : Documentation
- [ ] Mettre à jour `README.md` avec instructions plugin
- [ ] Créer guide d'installation détaillé

## Fichiers à créer/modifier

| Fichier | Action | Status |
|---------|--------|--------|
| `plugin/.claude-plugin/plugin.json` | Créer | ⏳ TODO |
| `.claude-plugin/marketplace.json` | Créer | ⏳ TODO |
| `plugin/commands/codegraph-setup.md` | Créer | ⏳ TODO |
| `plugin/commands/codegraph-indexer.md` | Créer | ⏳ TODO |
| `plugin/.mcp.json` | Créer | ⏳ TODO |
| `plugin/docker-compose.yml` | Créer (copie) | ⏳ TODO |
| `mcp-server/src/tools/index-codebase/*` | Créer | ⏳ TODO |
| `mcp-server/package.json` | Ajouter script bundle | ⏳ TODO |
| `README.md` | Mettre à jour | ⏳ TODO |

## Dépendances existantes (déjà installées)

```json
{
  "tree-sitter": "^0.22.4",
  "tree-sitter-kotlin": "^0.3.9",
  "neo4j-driver": "^5.28.1",
  "@modelcontextprotocol/sdk": "^1.24.3"
}
```

**Dépendance à ajouter pour bundling** :
```json
{
  "esbuild": "^0.24.0"
}
```

## Résumé des progrès

### Complété ✅

| Composant | Description | Tests |
|-----------|-------------|-------|
| **Types communs** | 15+ interfaces pour représenter le code Kotlin parsé | - |
| **Parser registry** | Registre modulaire des parsers par extension | - |
| **Parser Kotlin** | Parsing tree-sitter avec extraction complète | 123 |
| **Resolver** | Résolution des symboles et appels cross-fichiers | 48 |
| **Writer** | Écriture batch vers Neo4j avec Testcontainers | 91 |

**Total : 262 tests**

### Fonctionnalités Kotlin supportées

| Catégorie | Fonctionnalités |
|-----------|-----------------|
| **Classes** | class, interface, object, enum, annotation, data, sealed, abstract |
| **Membres** | functions, properties, companion objects, nested classes |
| **Constructeurs** | primary (avec val/var properties), secondary |
| **Generics** | type parameters, bounds, variance (in/out), reified, where clause |
| **Fonctions** | extension, suspend, inline, infix, operator |
| **Lambda** | function types, receiver types, crossinline, noinline |
| **Appels** | chained calls, nested calls, safe calls (?.), qualified calls (FQN) |
| **Autres** | imports, annotations avec arguments, type aliases, destructuring |

### Prochaines étapes

1. ~~**Resolver** : Résolution des symboles et appels cross-fichiers~~ ✅ DONE
2. ~~**Writer** : Écriture batch vers Neo4j~~ ✅ DONE
3. **Plugin** : Structure + commandes + bundling ⏳ EN COURS

## Spécifications des commandes

### `/codegraph-setup`

**But** : Préparer l'environnement Neo4j

**Actions** :
1. Vérifier que Docker est installé et démarré
2. Démarrer le container Neo4j via docker-compose
3. Attendre que Neo4j soit prêt (health check)
4. Créer les contraintes et index dans Neo4j
5. Afficher l'URL de Neo4j Browser

**Output attendu** :
```
✓ Docker is running
✓ Starting Neo4j container...
✓ Neo4j is ready at bolt://localhost:7687
✓ Constraints and indexes created
✓ Neo4j Browser: http://localhost:7474

CodeGraph is ready! Use /codegraph-indexer to index a Kotlin project.
```

### `/codegraph-indexer`

**But** : Indexer le projet Kotlin courant

**Actions** :
1. Vérifier que Neo4j est accessible
2. Scanner les fichiers .kt dans le répertoire courant
3. Parser chaque fichier avec tree-sitter
4. Résoudre les symboles cross-fichiers
5. Écrire le graphe dans Neo4j
6. Afficher les statistiques

**Output attendu** :
```
Indexing /path/to/project...

Scanning files...
✓ Found 42 Kotlin files

Parsing...
✓ 42/42 files parsed

Resolving symbols...
✓ 156 calls resolved (89% resolution rate)

Writing to Neo4j...
✓ 23 packages
✓ 45 classes
✓ 12 interfaces
✓ 234 functions
✓ 89 properties
✓ 156 CALLS relationships

Done! Explore your code graph at http://localhost:7474
```

## Schema Neo4j (rappel)

Les nœuds et relations suivent le schema existant dans `docs/SCHEMA.md` :
- **Nœuds** : Package, Class, Interface, Object, Function, Property, Parameter, Annotation
- **Relations** : CONTAINS, DECLARES, EXTENDS, IMPLEMENTS, CALLS, USES, HAS_PARAMETER, ANNOTATED_WITH, RETURNS

## Ajout d'un nouveau langage

Pour ajouter Java par exemple :

1. Créer `mcp-server/src/indexer/parsers/java/`
2. Implémenter `parser.ts` et `extractor.ts` selon l'interface `LanguageParser`
3. Enregistrer dans `registry.ts` : `.java` → java parser
4. Re-bundler le plugin : `npm run bundle`
5. C'est tout ! Le resolver et writer sont réutilisés.
