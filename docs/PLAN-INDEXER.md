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
│       │   ├── resolver.ts       # Résolution des appels (partagé)
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

### Étape 1 : Setup structure et types communs
- [ ] Créer `mcp-server/src/indexer/types.ts` avec les interfaces communes :
  - `ParsedFile`, `ParsedClass`, `ParsedFunction`, `ParsedProperty`
  - `ParsedCall`, `ParsedImport`
  - `LanguageParser` (interface pour tous les parsers)
- [ ] Créer `mcp-server/src/indexer/parsers/registry.ts` :
  - Registre des parsers par extension (`.kt` → kotlin, `.java` → java)
  - Fonction `getParserForFile(filePath): LanguageParser`

### Étape 2 : Parser Kotlin
- [ ] Installer `tree-sitter` et `tree-sitter-kotlin`
- [ ] Créer `mcp-server/src/indexer/parsers/kotlin/parser.ts` :
  - Initialisation tree-sitter-kotlin
  - Fonction `parse(source: string): Tree`
- [ ] Créer `mcp-server/src/indexer/parsers/kotlin/extractor.ts` :
  - Parcours de l'AST tree-sitter
  - Extraction des classes, interfaces, objects
  - Extraction des fonctions et propriétés
  - Extraction des appels de fonction (syntaxiques)
  - Extraction des imports et extends/implements
- [ ] Créer `mcp-server/src/indexer/parsers/kotlin/index.ts` :
  - Export du parser Kotlin implémentant `LanguageParser`
- [ ] Enregistrer le parser Kotlin dans `registry.ts`
- [ ] Tester le parsing d'un fichier .kt simple

### Étape 3 : Résolveur de symboles
- [ ] Créer `mcp-server/src/indexer/resolver.ts` :
  - Construction d'une table des symboles globale
  - Résolution des types de propriétés
  - Résolution des appels via heuristiques :
    - Type explicite du receiver
    - Imports
    - Même fichier/package

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

| Fichier | Action |
|---------|--------|
| `mcp-server/package.json` | Ajouter dépendances + bin |
| `mcp-server/src/cli.ts` | Créer (CLI codegraph-indexer) |
| `mcp-server/src/indexer/types.ts` | Créer (types communs) |
| `mcp-server/src/indexer/parsers/registry.ts` | Créer (registre des parsers) |
| `mcp-server/src/indexer/parsers/kotlin/parser.ts` | Créer |
| `mcp-server/src/indexer/parsers/kotlin/extractor.ts` | Créer |
| `mcp-server/src/indexer/parsers/kotlin/index.ts` | Créer |
| `mcp-server/src/indexer/resolver.ts` | Créer (partagé) |
| `mcp-server/src/indexer/writer.ts` | Créer (partagé) |
| `mcp-server/src/indexer/index.ts` | Créer |
| `mcp-server/src/tools/index-codebase/*` | Créer (4 fichiers) |
| `mcp-server/src/index.ts` | Modifier (enregistrer tool) |
| `docs/INDEXING.md` | Créer |
| `docs/commands/codegraph-indexer.md` | Créer (slash command) |
| `README.md` | Modifier (ajouter instructions)

## Dépendances à ajouter

```json
{
  "tree-sitter": "^0.21.1",
  "tree-sitter-kotlin": "^0.3.8",
  "glob": "^10.3.10",
  "commander": "^12.1.0"
}
```

Notes:
- `glob` : scanner récursivement les fichiers .kt
- `commander` : parsing des arguments CLI

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
