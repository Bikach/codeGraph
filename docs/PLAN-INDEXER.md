# Plan : Indexeur Tree-sitter Kotlin

## Objectif
Créer un indexeur Kotlin avec tree-sitter, utilisable via :
1. **Commande bash** : `codegraph-indexer /path/to/project`
2. **Slash command Claude Code** (optionnelle) : `/codegraph-indexer` (utilise le projet courant)

## Architecture cible

**Approche hybride** : Neo4j dans Docker, CLI exécuté en local.

Pourquoi ce choix :
- **Performance I/O** : Docker Desktop sur macOS utilise une VM, les volumes sont lents pour scanner des milliers de fichiers `.kt`
- **Simplicité** : Pas de gestion de chemins/volumes complexes
- **Claude Desktop** : Le MCP server doit tourner en local pour être appelé par Claude

```
codegraph/
├── mcp-server/
│   └── src/
│       ├── index.ts              # MCP server (existant)
│       ├── cli.ts                # NEW: Entry point CLI `codegraph-indexer`
│       ├── indexer/              # NEW: Module indexeur
│       │   ├── parsers/          # Parsers par langage (modulaires)
│       │   │   ├── kotlin/
│       │   │   │   ├── parser.ts     # Parsing tree-sitter-kotlin
│       │   │   │   ├── extractor.ts  # Extraction spécifique Kotlin
│       │   │   │   └── index.ts
│       │   │   ├── java/             # (future)
│       │   │   ├── php/              # (future)
│       │   │   └── registry.ts   # Registre des parsers disponibles
│       │   ├── resolver/         # Résolution des symboles (modulaire) ✅
│       │   │   ├── types.ts      # Types du resolver
│       │   │   ├── resolver.ts   # Logique de résolution
│       │   │   └── index.ts      # Exports
│       │   ├── writer.ts         # Écriture batch Neo4j (partagé)
│       │   ├── types.ts          # Types communs
│       │   └── index.ts          # Exports
│       └── tools/
│           └── index-codebase/   # NEW: Outil MCP générique (auto-détecte les langages)
│               ├── definition.ts
│               ├── handler.ts
│               ├── types.ts
│               └── index.ts
├── docker-compose.yml            # Neo4j uniquement
├── README.md                     # UPDATE: Instructions
└── docs/
    ├── INDEXING.md               # NEW: Guide d'indexation
    └── commands/
        └── codegraph-indexer.md  # NEW: Slash command (à copier dans ~/.claude/)
```

### Pourquoi des parsers modulaires ?

- **Isolation** : Chaque langage ~300-400 lignes, isolé dans son dossier
- **Contexte LLM** : Claude peut lire uniquement le parser pertinent
- **Extensibilité** : Ajout d'un langage = nouveau dossier, sans toucher aux autres
- **Code partagé** : resolver, writer, types restent communs à tous les langages

## Deux façons d'indexer

### Option 1 : Commande bash (terminal)
```bash
# Depuis n'importe où
codegraph-indexer /path/to/kotlin/project

# Ou via npm/npx
cd mcp-server && npm run index -- /path/to/kotlin/project
```

### Option 2 : Slash command Claude Code (optionnelle)
```bash
# L'utilisateur copie la commande dans son Claude Code :
cp docs/commands/codegraph-indexer.md ~/.claude/commands/

# Puis dans Claude Code :
/codegraph-indexer
# → Indexe automatiquement le projet courant (working directory)
```

## Comment ça marche

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Machine locale                               │
│                                                                         │
│    ┌─────────────┐       ┌───────────────┐       ┌───────────────┐     │
│    │  Terminal   │       │  Claude Code  │       │Claude Desktop │     │
│    │  (direct)   │       │ /codegraph-   │       │  "Indexe..."  │     │
│    │             │       │   indexer     │       │               │     │
│    └──────┬──────┘       └───────┬───────┘       └───────┬───────┘     │
│           │                      │                       │              │
│           │                      │ (appelle bash)        │ (outil MCP)  │
│           │                      │                       │              │
│           └──────────────────────┼───────────────────────┘              │
│                                  │                                      │
│                                  ▼                                      │
│                   ┌─────────────────────────────────┐                   │
│                   │      indexer/ (logique)         │                   │
│                   │  parser → extractor → resolver  │                   │
│                   │            → writer             │                   │
│                   └───────────────┬─────────────────┘                   │
│                                   │                                     │
└───────────────────────────────────┼─────────────────────────────────────┘
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
- [x] Créer `mcp-server/src/indexer/types.ts` avec les interfaces communes :
  - `ParsedFile`, `ParsedClass`, `ParsedFunction`, `ParsedProperty`
  - `ParsedCall`, `ParsedImport`
  - `LanguageParser` (interface pour tous les parsers)
  - **Ajouts** : `ParsedTypeParameter`, `ParsedConstructor`, `ParsedTypeAlias`, `ParsedDestructuringDeclaration`, `ParsedObjectExpression`, `ParsedFunctionType`
- [x] Créer `mcp-server/src/indexer/parsers/registry.ts` :
  - Registre des parsers par extension (`.kt` → kotlin, `.java` → java)
  - Fonction `getParserForFile(filePath): LanguageParser`

### Étape 2 : Parser Kotlin ✅ DONE (123 tests)
- [x] Installer `tree-sitter` et `tree-sitter-kotlin`
- [x] Créer `mcp-server/src/indexer/parsers/kotlin/parser.ts` :
  - Initialisation tree-sitter-kotlin
  - Fonction `parse(source: string): Tree`
- [x] Créer `mcp-server/src/indexer/parsers/kotlin/extractor.ts` :
  - Parcours de l'AST tree-sitter
  - Extraction des classes, interfaces, objects, enums, annotations
  - Extraction des fonctions et propriétés
  - Extraction des appels de fonction (syntaxiques)
  - Extraction des imports et extends/implements
  - **Fonctionnalités avancées implémentées** :
    - Companion objects
    - Primary constructor properties (`class User(val id: String)`)
    - Generics / Type parameters avec bounds et variance
    - Secondary constructors
    - Inline, infix, operator functions
    - Type aliases
    - Destructuring declarations
    - Object expressions (anonymous objects)
    - Annotation arguments
    - Reified type parameters
    - Crossinline/noinline modifiers
    - Multiple type bounds (where clause)
    - Lambda parameters (function types with receiver, suspend)
- [x] Créer `mcp-server/src/indexer/parsers/kotlin/index.ts` :
  - Export du parser Kotlin implémentant `LanguageParser`
- [x] Enregistrer le parser Kotlin dans `registry.ts`
- [x] Tester le parsing : **123 tests passants**
  - Tests ajoutés : chained calls, safe calls, qualified calls, argument types inference

### Étape 3 : Résolveur de symboles ✅ DONE (48 tests)
- [x] Créer `mcp-server/src/indexer/resolver/` (module modulaire) :
  - `types.ts` : Types du resolver (Symbol, FunctionSymbol, SymbolTable, ResolutionContext)
  - `resolver.ts` : Logique de résolution des symboles
  - `index.ts` : Exports publics
  - `index.test.ts` : Tests unitaires (41 tests)
- [x] Construction d'une table des symboles globale (buildSymbolTable)
- [x] Résolution des types de propriétés
- [x] Résolution des appels via heuristiques :
  - Type explicite du receiver
  - Variables locales et paramètres
  - Imports explicites et wildcards
  - Même fichier/package
  - Hiérarchie de types (superclass, interfaces)
  - Companion objects
  - Extension functions
- [x] Utilitaires : lookupSymbol, findSymbols, getResolutionStats
- [x] Tests ajoutés : constructor calls resolution, overload resolution, qualified calls

### Étape 4 : Writer Neo4j
- [ ] Créer `mcp-server/src/indexer/writer.ts` :
  - Création des nœuds (Package, Class, Interface, Function, etc.)
  - Création des relations (CONTAINS, DECLARES, CALLS, USES, etc.)
  - Batch processing pour performance
  - Gestion des contraintes d'unicité

### Étape 5 : CLI `codegraph-indexer`
- [ ] Créer `mcp-server/src/cli.ts` :
  - Parsing des arguments avec `commander`
  - Scan récursif des fichiers .kt
  - Appel du module `indexer/`
  - Affichage de la progression
- [ ] Ajouter dans `package.json` :
  - Script : `"index": "tsx src/cli.ts"`
  - Bin : `"codegraph-indexer": "./dist/cli.js"`

### Étape 6 : Outil MCP index_codebase (générique)
- [ ] Créer `mcp-server/src/tools/index-codebase/` :
  - `definition.ts` : schema avec paramètres :
    - `project_path` (requis)
    - `languages` (optionnel, auto-détecte si absent)
  - `handler.ts` :
    - Auto-détection des langages (.kt, .java, etc.)
    - Appelle le parser approprié pour chaque langage
  - `types.ts` : types de résultat
- [ ] Enregistrer l'outil dans `index.ts`

### Étape 7 : Documentation
- [ ] Créer `docs/INDEXING.md` :
  - Guide complet d'indexation
  - Exemples de projets Kotlin
  - Troubleshooting
- [ ] Créer `docs/commands/codegraph-indexer.md` :
  - Slash command Claude Code prête à copier
  - Exécute `codegraph-indexer $PWD`
- [ ] Mettre à jour `README.md` :
  - Section "Quick Start" avec docker-compose
  - Section "Indexing a Project" (bash + Claude Code)

## Fichiers à créer/modifier

| Fichier | Action | Status |
|---------|--------|--------|
| `mcp-server/package.json` | Ajouter dépendances + bin | ✅ Dépendances ajoutées |
| `mcp-server/src/cli.ts` | Créer (CLI codegraph-indexer) | ⏳ TODO |
| `mcp-server/src/indexer/types.ts` | Créer (types communs) | ✅ DONE |
| `mcp-server/src/indexer/parsers/registry.ts` | Créer (registre des parsers) | ✅ DONE |
| `mcp-server/src/indexer/parsers/kotlin/parser.ts` | Créer | ✅ DONE |
| `mcp-server/src/indexer/parsers/kotlin/extractor.ts` | Créer | ✅ DONE (~1350 lignes) |
| `mcp-server/src/indexer/parsers/kotlin/index.ts` | Créer | ✅ DONE |
| `mcp-server/src/indexer/parsers/kotlin/index.test.ts` | Tests | ✅ DONE (123 tests) |
| `mcp-server/src/indexer/resolver/` | Créer (module modulaire) | ✅ DONE |
| `mcp-server/src/indexer/writer.ts` | Créer (partagé) | ⏳ TODO |
| `mcp-server/src/indexer/index.ts` | Créer | ✅ DONE |
| `mcp-server/src/tools/index-codebase/*` | Créer (4 fichiers) | ⏳ TODO |
| `mcp-server/src/index.ts` | Modifier (enregistrer tool) | ⏳ TODO |
| `docs/INDEXING.md` | Créer | ⏳ TODO |
| `docs/commands/codegraph-indexer.md` | Créer (slash command) | ⏳ TODO |
| `README.md` | Modifier (ajouter instructions) | ⏳ TODO |

## Dépendances à ajouter

```json
{
  "tree-sitter": "^0.22.4",
  "tree-sitter-kotlin": "^0.3.9"
}
```

**Dépendances à ajouter pour CLI (Étape 5)** :
```json
{
  "glob": "^10.3.10",
  "commander": "^12.1.0"
}
```

Notes:
- `glob` : scanner récursivement les fichiers .kt
- `commander` : parsing des arguments CLI

## Résumé des progrès

### Complété ✅

| Composant | Description | Tests |
|-----------|-------------|-------|
| **Types communs** | 15+ interfaces pour représenter le code Kotlin parsé | - |
| **Parser registry** | Registre modulaire des parsers par extension | - |
| **Parser Kotlin** | Parsing tree-sitter avec extraction complète | 123 |
| **Resolver** | Résolution des symboles et appels cross-fichiers | 48 |

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
2. **Writer** : Écriture batch vers Neo4j
3. **CLI** : Commande `codegraph-indexer`
4. **MCP Tool** : Outil `index_codebase` pour Claude

## Schema Neo4j (rappel)

Les nœuds et relations suivent le schema existant dans `docs/SCHEMA.md` :
- **Nœuds** : Package, Class, Interface, Object, Function, Property, Parameter, Annotation
- **Relations** : CONTAINS, DECLARES, EXTENDS, IMPLEMENTS, CALLS, USES, HAS_PARAMETER, ANNOTATED_WITH, RETURNS

## Exemple de flux

```
UserService.kt
     │
     ▼ [registry.ts]
   Détecte .kt → charge parsers/kotlin/
     │
     ▼ [parsers/kotlin/parser.ts]
   AST tree-sitter
     │
     ▼ [parsers/kotlin/extractor.ts]
   ParsedFile {
     classes: [{ name: "UserService", functions: [...] }],
     imports: ["com.example.User"],
     ...
   }
     │
     ▼ [resolver.ts] (partagé)
   ResolvedFile {
     classes: [...],
     calls: [{ from: "UserService.save", to: "UserRepository.save" }]
   }
     │
     ▼ [writer.ts] (partagé)
   Neo4j: CREATE (c:Class), CREATE (f:Function), CREATE (c)-[:DECLARES]->(f)
```

## Ajout d'un nouveau langage

Pour ajouter Java par exemple :

1. Créer `mcp-server/src/indexer/parsers/java/`
2. Implémenter `parser.ts` et `extractor.ts` selon l'interface `LanguageParser`
3. Enregistrer dans `registry.ts` : `.java` → java parser
4. C'est tout ! Le resolver et writer sont réutilisés.
