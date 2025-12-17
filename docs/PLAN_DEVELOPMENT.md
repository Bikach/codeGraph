# Plan de développement CodeGraph

## Objectif
Créer un outil d'analyse de code **multi-langage** avec tree-sitter, distribué via un **plugin Claude Code** :
1. `/codegraph-setup` : Configure et démarre Neo4j via Docker
2. `/codegraph-index` : Indexe le projet courant (via script bash, zero tokens)
3. **MCP tools** : Requêtes sur le graphe (search_nodes, get_callers, etc.)

**Langages supportés** : Kotlin (premier langage), architecture extensible pour Java, TypeScript, etc.

## Architecture cible

**Approche Plugin Claude Code** : Distribution via marketplace GitHub, MCP server bundlé, Neo4j en Docker local.

Pourquoi ce choix :
- **Zero friction** : Installation via le store Claude Code
- **Bundling** : Tout le code JS est bundlé, pas de `npm install` chez l'user
- **Zero tokens pour indexation** : Les commandes slash appellent la CLI bash directement
- **MCP pour requêtes** : Les tools MCP sont utilisés pour explorer le graphe (search, callers, etc.)

```
codegraph/
├── mcp-server/
│   └── src/
│       ├── index.ts              # MCP server (tools de requêtes)
│       ├── scripts/              # Scripts d'action (un par commande)
│       │   ├── setup.ts          # Script setup Neo4j
│       │   ├── index-project.ts  # Script indexation
│       │   └── status.ts         # Script status
│       ├── indexer/              # Module indexeur ✅
│       │   ├── parsers/          # Parsers par langage (modulaires) ✅
│       │   │   ├── kotlin/       # Parser Kotlin (123 tests)
│       │   │   └── registry.ts   # Registre des parsers
│       │   ├── resolver/         # Résolution des symboles (48 tests) ✅
│       │   ├── writer/           # Écriture batch Neo4j (91 tests) ✅
│       │   ├── types.ts          # Types communs
│       │   └── index.ts          # Exports
│       └── tools/                # Outils MCP (requêtes sur le graphe)
├── plugin/                       # Plugin Claude Code
│   ├── .claude-plugin/
│   │   └── plugin.json           # Manifest du plugin
│   ├── commands/                 # Slash commands (fichiers Markdown)
│   │   ├── codegraph-setup.md    # /codegraph-setup
│   │   ├── codegraph-index.md    # /codegraph-index
│   │   └── codegraph-status.md   # /codegraph-status
│   ├── scripts/                  # Scripts bash (wrappers)
│   │   ├── setup.sh              # Appelle dist/setup.js
│   │   ├── index-project.sh      # Appelle dist/index-project.js
│   │   └── status.sh             # Appelle dist/status.js
│   ├── dist/                     # Bundles JS (esbuild)
│   │   ├── mcp-server.js         # MCP server bundlé
│   │   ├── setup.js              # Script setup bundlé
│   │   ├── index-project.js      # Script indexation bundlé
│   │   └── status.js             # Script status bundlé
│   ├── .mcp.json                 # Config MCP server
│   └── docker-compose.yml        # Neo4j config
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest
├── docker-compose.yml            # Neo4j (dev local)
└── README.md
```

## Comment l'utilisateur installe CodeGraph

```bash
# 1. Installer le plugin via le store Claude Code
/plugin install bikach/codegraph

# 2. Setup Neo4j (une seule fois par machine)
/codegraph-setup

# 3. Indexer un projet Kotlin
cd /path/to/kotlin/project
/codegraph-index

# 4. Vérifier le status
/codegraph-status

# 5. Utiliser les tools MCP pour explorer
# (automatiquement disponibles via le plugin)
```

## Comment ça marche

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Machine locale                               │
│                                                                         │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │                      Claude Code                             │     │
│    │                                                              │     │
│    │   /codegraph-setup       /codegraph-index    /codegraph-status│    │
│    │         │                      │                    │        │     │
│    │         ▼                      ▼                    ▼        │     │
│    │   bash: setup.sh      bash: index-project.sh   bash: status.sh    │
│    │         │                      │                    │        │     │
│    │         ▼                      ▼                    ▼        │     │
│    │   ┌──────────────────────────────────────────────────────┐  │     │
│    │   │            Scripts JS bundlés (plugin/dist/)         │  │     │
│    │   │   setup.js │ index-project.js │ status.js            │  │     │
│    │   │            │ parser → resolver → writer              │  │     │
│    │   └──────────────────────────┬───────────────────────────┘  │     │
│    │                              │                               │     │
│    │   MCP Tools (requêtes)       │                               │     │
│    │   search_nodes, get_callers..│                               │     │
│    │         │                    │                               │     │
│    │         ▼                    ▼                               │     │
│    │   ┌─────────────────────────────────────────────────┐       │     │
│    │   │         MCP Server (plugin/dist/mcp-server.js)  │       │     │
│    │   └─────────────────────────┬───────────────────────┘       │     │
│    └─────────────────────────────┼───────────────────────────────┘     │
│                                  │                                      │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────────┐
                    │      Docker (Neo4j only)      │
                    │  ┌───────────────────────┐    │
                    │  │    Neo4j (7687)       │    │
                    │  └───────────────────────┘    │
                    └───────────────────────────────┘
```

**Séparation des responsabilités** :
- **Commandes slash** → scripts bash → scripts JS : Actions (setup, index, status) → **zero tokens**
- **MCP Server** → tools : Requêtes (lecture) → utilisé par Claude pour explorer le graphe

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

### Étape 5 : Scripts d'action ⏳ TODO

#### 5.1 Scripts dédiés (un par action)
- [ ] Créer `mcp-server/src/scripts/index-project.ts` : indexe un projet
- [ ] Créer `mcp-server/src/scripts/setup.ts` : démarre Neo4j via docker-compose
- [ ] Créer `mcp-server/src/scripts/status.ts` : vérifie la connexion Neo4j
- [ ] Sans dépendances externes (ANSI colors natifs)

### Étape 6 : MCP Tools (requêtes) ⏳ TODO

- [ ] Implémenter les requêtes Cypher dans les handlers existants :
  - `search_nodes` : Recherche de nœuds par nom/pattern
  - `get_callers` : Fonctions qui appellent une fonction
  - `get_callees` : Fonctions appelées par une fonction
  - `get_neighbors` : Dépendances et dépendants d'une classe
  - `get_implementations` : Implémentations d'une interface
  - `get_impact` : Analyse d'impact d'une modification
  - `find_path` : Chemin entre deux nœuds
  - `get_file_symbols` : Symboles d'un fichier

### Étape 7 : Plugin Claude Code ⏳ TODO

#### Architecture du plugin

Un plugin Claude Code est composé de plusieurs éléments optionnels :

```
codegraph-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest obligatoire (nom, version, description)
├── commands/                 # Slash commands (fichiers Markdown)
│   ├── codegraph-setup.md   # /codegraph-setup
│   ├── codegraph-index.md   # /codegraph-index
│   └── codegraph-status.md  # /codegraph-status
├── agents/                   # Agents spécialisés (optionnel)
│   └── code-analyzer.md
├── skills/                   # Skills invoquées par Claude (optionnel)
│   └── kotlin-analysis/
│       └── SKILL.md
├── scripts/                  # Scripts bash (wrappers)
│   ├── setup.sh             # Appelle node dist/setup.js
│   ├── index-project.sh     # Appelle node dist/index-project.js
│   └── status.sh            # Appelle node dist/status.js
├── dist/                     # Bundles JS (esbuild)
│   ├── mcp-server.js        # MCP server bundlé
│   ├── setup.js             # Script setup bundlé
│   ├── index-project.js     # Script indexation bundlé
│   └── status.js            # Script status bundlé
├── .mcp.json                # Configuration MCP server
└── docker-compose.yml       # Neo4j config
```

**Composants utilisés par CodeGraph** :
- **Commands** : Slash commands qui exécutent les scripts bash (zero tokens)
- **Scripts bash** : Wrappers simples qui appellent les scripts JS bundlés
- **Scripts JS** : Logique métier (setup, indexation, status)
- **MCP Server** : Tools de requêtes sur le graphe (search_nodes, get_callers, etc.)

**Note** : On utilise les **commands** et non les hooks car l'indexation est une action manuelle déclenchée par l'utilisateur, pas une réaction automatique à un événement.

#### 7.1 Structure du plugin
- [ ] Créer `plugin/.claude-plugin/plugin.json` (manifest)
- [ ] Créer `.claude-plugin/marketplace.json` (marketplace à la racine)

#### 7.2 Scripts bash (wrappers)
- [ ] Créer `plugin/scripts/setup.sh`
- [ ] Créer `plugin/scripts/index-project.sh`
- [ ] Créer `plugin/scripts/status.sh`

#### 7.3 Commandes slash
- [ ] Créer `plugin/commands/codegraph-setup.md` → exécute `${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh`
- [ ] Créer `plugin/commands/codegraph-index.md` → exécute `${CLAUDE_PLUGIN_ROOT}/scripts/index-project.sh`
- [ ] Créer `plugin/commands/codegraph-status.md` → exécute `${CLAUDE_PLUGIN_ROOT}/scripts/status.sh`

#### 7.4 Bundling
- [ ] Configurer esbuild pour bundler :
  - `src/index.ts` → `plugin/dist/mcp-server.js`
  - `src/scripts/setup.ts` → `plugin/dist/setup.js`
  - `src/scripts/index-project.ts` → `plugin/dist/index-project.js`
  - `src/scripts/status.ts` → `plugin/dist/status.js`
- [ ] Créer `plugin/.mcp.json` avec config du server
- [ ] Copier `docker-compose.yml` dans `plugin/`
- [ ] Ajouter script `npm run bundle` dans package.json

### Étape 8 : Documentation
- [ ] Mettre à jour `README.md` avec instructions plugin
- [ ] Créer guide d'installation détaillé

## Fichiers à créer/modifier

| Fichier | Action | Status |
|---------|--------|--------|
| `mcp-server/src/scripts/setup.ts` | Créer | ⏳ TODO |
| `mcp-server/src/scripts/index-project.ts` | Créer | ⏳ TODO |
| `mcp-server/src/scripts/status.ts` | Créer | ⏳ TODO |
| `mcp-server/src/tools/*/handler.ts` | Implémenter requêtes Cypher | ⏳ TODO |
| `plugin/.claude-plugin/plugin.json` | Créer | ⏳ TODO |
| `.claude-plugin/marketplace.json` | Créer | ⏳ TODO |
| `plugin/scripts/setup.sh` | Créer | ⏳ TODO |
| `plugin/scripts/index-project.sh` | Créer | ⏳ TODO |
| `plugin/scripts/status.sh` | Créer | ⏳ TODO |
| `plugin/commands/codegraph-setup.md` | Créer | ⏳ TODO |
| `plugin/commands/codegraph-index.md` | Créer | ⏳ TODO |
| `plugin/commands/codegraph-status.md` | Créer | ⏳ TODO |
| `plugin/.mcp.json` | Créer | ⏳ TODO |
| `plugin/docker-compose.yml` | Copier | ⏳ TODO |
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

**Dépendances à ajouter pour bundling** :
```json
{
  "esbuild": "^0.24.0"
}
```

Note : Les scripts n'utilisent pas de dépendances externes (commander, chalk, ora). Ils utilisent les ANSI codes natifs pour les couleurs.

## Résumé des progrès

### Complété ✅

| Composant | Description | Tests |
|-----------|-------------|-------|
| **Types communs** | 15+ interfaces pour représenter le code Kotlin parsé | - |
| **Parser registry** | Registre modulaire des parsers par extension | - |
| **Parser Kotlin** | Parsing tree-sitter avec extraction complète | 123 |
| **Resolver** | Résolution des symboles et appels cross-fichiers | 48 |
| **Writer** | Écriture batch vers Neo4j avec Testcontainers | 91 |
| **Scripts** | À créer : index/setup/status | - |

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
3. **Scripts** : Scripts dédiés (setup, index, status) ⏳ TODO
4. **MCP Tools** : Requêtes Cypher (search, callers, etc.) ⏳ TODO
5. **Plugin** : Structure + commandes + bundling ⏳ TODO

## Spécifications des scripts

### `setup.ts` → `/codegraph-setup`

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

CodeGraph is ready! Use /codegraph-index to index a project.
```

### `index-project.ts` → `/codegraph-index`

**But** : Indexer un projet Kotlin

**Arguments** (passés via le script bash) :
- `<path>` : Chemin du projet (défaut: `.`)
- `--clear` : Vide la base avant indexation
- `--exclude <pattern>` : Exclut des fichiers (glob pattern)
- `--exclude-tests` : Exclut les fichiers de test (*Test.kt, *Spec.kt)

**Actions** :
1. Vérifier que Neo4j est accessible
2. Scanner les fichiers .kt dans le chemin spécifié
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

### `status.ts` → `/codegraph-status`

**But** : Vérifier l'état de Neo4j et afficher les stats du graphe

**Output attendu** :
```
Neo4j: ✓ Connected (bolt://localhost:7687)

Graph statistics:
  Packages:   23
  Classes:    45
  Interfaces: 12
  Functions:  234
  Properties: 89

  CALLS:      156
  EXTENDS:    12
  IMPLEMENTS: 8
```

## Comment les commandes slash appellent les scripts

Les commandes slash sont des fichiers Markdown qui contiennent des **instructions pour Claude**.
Quand l'utilisateur tape `/codegraph-index`, Claude lit le fichier et **exécute le script bash**.

```
┌──────────────────────────────────────────────────────────────────┐
│  Utilisateur tape: /codegraph-index                              │
│         │                                                        │
│         ▼                                                        │
│  Claude Code lit: plugin/commands/codegraph-index.md             │
│         │                                                        │
│         ▼                                                        │
│  Le fichier contient: "Exécute le script index-project.sh"       │
│         │                                                        │
│         ▼                                                        │
│  Claude exécute: bash ${CLAUDE_PLUGIN_ROOT}/scripts/index-project.sh
│         │                                                        │
│         ▼                                                        │
│  Le script bash appelle: node ${CLAUDE_PLUGIN_ROOT}/dist/index-project.js
│         │                                                        │
│         ▼                                                        │
│  Le script JS s'exécute (ZERO tokens LLM)                        │
│         │                                                        │
│         ▼                                                        │
│  Output affiché à l'utilisateur                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Pourquoi c'est efficace** :
- L'indexation se fait **directement dans le terminal**
- Claude ne parse pas le contenu des fichiers Kotlin
- **Zero tokens** consommés pour l'indexation
- Le MCP server est utilisé uniquement pour les **requêtes** (search, callers, etc.)

## Spécifications des commandes slash

### `/codegraph-setup`

Contenu de `plugin/commands/codegraph-setup.md` :
```markdown
Démarre Neo4j pour CodeGraph.

Exécute la commande suivante :
\`\`\`bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh
\`\`\`

Si la commande échoue, vérifie que Docker est installé et démarré.
```

Contenu de `plugin/scripts/setup.sh` :
```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/../dist/setup.js" "$@"
```

### `/codegraph-index`

Contenu de `plugin/commands/codegraph-index.md` :
```markdown
Indexe le projet courant dans Neo4j.

Exécute la commande suivante :
\`\`\`bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/index-project.sh .
\`\`\`

Affiche le résumé de l'indexation à l'utilisateur.
```

Contenu de `plugin/scripts/index-project.sh` :
```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/../dist/index-project.js" "$@"
```

### `/codegraph-status`

Contenu de `plugin/commands/codegraph-status.md` :
```markdown
Affiche le status de Neo4j et les statistiques du graphe.

Exécute la commande suivante :
\`\`\`bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/status.sh
\`\`\`
```

Contenu de `plugin/scripts/status.sh` :
```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/../dist/status.js" "$@"
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
