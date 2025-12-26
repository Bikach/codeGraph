# Plan de Refactoring de l'Indexer CodeGraph

## Objectif
Refactorer les fichiers volumineux de l'indexer en modules plus petits (1 fichier par fonction, 1 test par fichier source) pour améliorer la maintenabilité.

## Règles
- **Ne pas modifier les méthodes** - les déplacer telles quelles
- **Reporter les tests existants** vers les nouveaux fichiers
- Chaque étape = déplacement de code + tests associés
- Validation : `npm test` + `npm run typecheck` après chaque étape

---

## Phase 1: Module Domain ✅ TERMINÉ

**Commit:** `d7f6f4d` - refactor(indexer): split domain module into smaller single-function files

### Résultat
| Avant | Après |
|-------|-------|
| 378 lignes | 85 lignes (index.ts) |
| 1 fichier test | 12 fichiers tests |
| 10 tests | 62 tests |

### Structure Finale
```
domain/
├── index.ts                    # Point d'entrée (85 lignes)
├── types.ts                    # Inchangé
├── utils/
│   ├── index.ts
│   ├── capitalize.ts + .test.ts
│   └── merge-domains.ts + .test.ts
├── pattern-matching/
│   ├── index.ts
│   ├── matches-pattern.ts + .test.ts
│   └── matches-any-pattern.ts + .test.ts
├── inference/
│   ├── index.ts
│   ├── extract-domain-from-package.ts + .test.ts
│   ├── detect-primary-language.ts + .test.ts
│   └── infer-domains-from-packages.ts + .test.ts
├── assignment/
│   ├── index.ts
│   └── assign-packages-to-domains.ts + .test.ts
├── config/
│   ├── index.ts
│   └── load-domains-config.ts + .test.ts
└── dependencies/
    ├── index.ts
    ├── extract-package-from-fqn.ts + .test.ts
    └── calculate-domain-dependencies.ts + .test.ts
```

---

## Phase 2: Kotlin Extractor ✅ TERMINÉ

**Fichier source:** `parsers/kotlin/extractor.ts` (1351 lignes → 8 lignes, 39 fonctions extraites)
**Fichier test:** `parsers/kotlin/index.test.ts` (1525 lignes, 123 tests) + 200+ nouveaux tests unitaires

### Progression

| # | Module | Status | Commit | Tests ajoutés |
|---|--------|--------|--------|---------------|
| 1 | ast-utils/ | ✅ | `e67e38a` | 22 tests |
| 2 | modifiers/ (base) | ✅ | `9bee7db` | 18 tests |
| 3 | modifiers/ (annotations) | ✅ | `5feb454` | 12 tests |
| 4 | calls/type-inference/ | ✅ | `d5f45a1` | 27 tests |
| 5 | package/ | ✅ | `e5d4a99` | 11 tests |
| 6 | generics/ | ✅ | `97f77a7` | 21 tests |
| 7 | property/, function/ params | ✅ | `d0394ff` | - |
| 8 | calls/ (rest) | ✅ | `66cceab` | - |
| 9 | function/ | ✅ | `78fc9b8` | - |
| 10 | constructor/ | ✅ | `3b44be2` | - |
| 11 | companion/ (partial) | ✅ | `1e8b579` | - |
| 12 | class/ infra (partial) | ✅ | `34168bf` | - |
| 13 | advanced/ | ✅ | `2e479b2` | 26 tests |
| 14 | object-expressions/ | ✅ | `c01cc72` | 29 tests |
| 15 | class/, extractor/ | ✅ | - | 61 tests |
| 16 | Nettoyage cohérence | ✅ | - | - |

### Nettoyage post-Phase 2

Le fichier wrapper `extractor.ts` à la racine a été supprimé car il créait
une double couche de re-export inutile. `index.ts` importe maintenant
directement de `extractor/index.js`.

### Structure Cible
```
parsers/kotlin/
├── index.ts                    # LanguageParser
├── parser.ts                   # Tree-sitter (inchangé)
├── extractor/
│   ├── index.ts                # Re-exports extractSymbols
│   ├── extract-symbols.ts + .test.ts
│   │
│   ├── ast-utils/              # Commit 1 (feuilles - aucune dépendance)
│   │   ├── index.ts
│   │   ├── find-child-by-type.ts + .test.ts
│   │   ├── traverse-node.ts + .test.ts
│   │   ├── node-location.ts + .test.ts
│   │   └── extract-type-name.ts + .test.ts
│   │
│   ├── modifiers/              # Commits 2-3
│   │   ├── index.ts
│   │   ├── map-visibility.ts + .test.ts
│   │   ├── extract-modifiers.ts + .test.ts
│   │   ├── extract-annotations.ts + .test.ts
│   │   └── extract-annotation-arguments.ts + .test.ts
│   │
│   ├── calls/                  # Commits 4, 8
│   │   ├── index.ts
│   │   ├── type-inference/
│   │   │   ├── index.ts
│   │   │   ├── is-expression-type.ts + .test.ts
│   │   │   ├── infer-expression-type.ts + .test.ts
│   │   │   ├── find-first-expression.ts + .test.ts
│   │   │   └── infer-argument-type.ts + .test.ts
│   │   ├── extract-navigation-path.ts + .test.ts
│   │   ├── extract-call-arguments.ts + .test.ts
│   │   ├── extract-call-expression.ts + .test.ts
│   │   └── extract-calls.ts + .test.ts
│   │
│   ├── package/                # Commit 5
│   │   ├── index.ts
│   │   ├── extract-package-name.ts + .test.ts
│   │   └── extract-imports.ts + .test.ts
│   │
│   ├── generics/               # Commit 6
│   │   ├── index.ts
│   │   ├── extract-single-type-parameter.ts + .test.ts
│   │   └── extract-type-parameters.ts + .test.ts
│   │
│   ├── property/               # Commit 7
│   │   ├── index.ts
│   │   └── extract-property.ts + .test.ts
│   │
│   ├── function/               # Commits 7, 9
│   │   ├── index.ts
│   │   ├── extract-parameters.ts + .test.ts
│   │   ├── extract-return-type.ts + .test.ts
│   │   ├── extract-receiver-type.ts + .test.ts
│   │   ├── extract-function-type.ts + .test.ts
│   │   └── extract-function.ts + .test.ts
│   │
│   ├── constructor/            # Commit 10
│   │   ├── index.ts
│   │   ├── extract-primary-constructor-properties.ts + .test.ts
│   │   └── extract-secondary-constructor.ts + .test.ts
│   │
│   ├── companion/              # Commit 11
│   │   ├── index.ts
│   │   ├── is-companion-object.ts + .test.ts
│   │   └── extract-companion-object.ts + .test.ts
│   │
│   ├── class/                  # Commits 12, 15
│   │   ├── index.ts
│   │   ├── map-class-kind.ts + .test.ts
│   │   ├── extract-super-types.ts + .test.ts
│   │   ├── extract-class-body.ts + .test.ts
│   │   └── extract-class.ts + .test.ts
│   │
│   ├── advanced/               # Commit 13
│   │   ├── index.ts
│   │   ├── extract-type-alias.ts + .test.ts
│   │   └── extract-destructuring-declaration.ts + .test.ts
│   │
│   └── object-expressions/     # Commit 14
│       ├── index.ts
│       ├── extract-object-expression.ts + .test.ts
│       └── extract-all-object-expressions.ts + .test.ts
```

### Ordre des Commits (15 commits)

| # | Module | Fonctions | Dépendances |
|---|--------|-----------|-------------|
| 1 | ast-utils/ | findChildByType, traverseNode, nodeLocation, extractTypeName | Aucune |
| 2 | modifiers/ | mapVisibility, extractModifiers | ast-utils |
| 3 | modifiers/ | extractAnnotations, extractAnnotationArguments | ast-utils |
| 4 | calls/type-inference/ | isExpressionType, inferExpressionType, findFirstExpression, inferArgumentType | ast-utils |
| 5 | package/ | extractPackageName, extractImports | ast-utils |
| 6 | generics/ | extractSingleTypeParameter, extractTypeParameters | ast-utils |
| 7 | property/, function/ params | extractProperty, extractParameters, extractReturnType, extractReceiverType, extractFunctionType | modifiers, ast-utils |
| 8 | calls/ | extractNavigationPath, extractCallArguments, extractCallExpression, extractCalls | type-inference, ast-utils |
| 9 | function/ | extractFunction | parameters, modifiers, generics, calls |
| 10 | constructor/ | extractPrimaryConstructorProperties, extractSecondaryConstructor | modifiers, ast-utils |
| 11 | companion/ | isCompanionObject | modifiers, ast-utils |
| 12 | class/ infra | mapClassKind, extractSuperTypes | ast-utils |
| 13 | advanced/ | extractTypeAlias, extractDestructuringDeclaration | modifiers, generics |
| 14 | object-expressions/ | extractObjectExpression, extractAllObjectExpressions | class-body, ast-utils |
| 15 | class/, extractor/ | extractClass, extractSymbols, index.ts | Tout |

---

## Phase 3: Resolver ⏳ EN ATTENTE

**Fichier source:** `resolver/index.ts` (1318 lignes)
**Fichier test:** `resolver/index.test.ts` (1638 lignes, 48 tests)

### Structure Cible
```
resolver/
├── index.ts
├── types.ts (inchangé)
├── stdlib/ (inchangé)
├── symbol-table/
│   ├── build-symbol-table.ts + .test.ts
│   ├── index-file.ts + .test.ts
│   ├── index-class.ts + .test.ts
│   ├── index-function.ts + .test.ts
│   └── add-symbol.ts + .test.ts
├── type-hierarchy/
│   ├── build-type-hierarchy.ts + .test.ts
│   ├── build-class-hierarchy.ts + .test.ts
│   └── resolve-type-name.ts + .test.ts
├── resolution/
│   ├── resolve-symbols.ts + .test.ts
│   ├── resolve-file.ts + .test.ts
│   ├── create-resolution-context.ts + .test.ts
│   ├── resolve-calls-in-class.ts + .test.ts
│   └── resolve-calls-in-function.ts + .test.ts
├── call-resolution/
│   ├── resolve-call.ts + .test.ts
│   ├── resolve-qualified-call.ts + .test.ts
│   ├── resolve-constructor-call.ts + .test.ts
│   ├── resolve-method-in-type.ts + .test.ts
│   ├── resolve-method-in-hierarchy.ts + .test.ts
│   ├── resolve-extension-function.ts + .test.ts
│   └── resolve-symbol-by-name.ts + .test.ts
├── overload-resolution/
│   ├── find-methods-in-type.ts + .test.ts
│   ├── select-best-overload.ts + .test.ts
│   ├── score-overload-match.ts + .test.ts
│   └── is-type-compatible.ts + .test.ts
└── utils/
    ├── get-resolution-stats.ts + .test.ts
    ├── lookup-symbol.ts + .test.ts
    └── find-symbols.ts + .test.ts
```

---

## Phase 4: Writer ⏳ EN ATTENTE

**Fichier source:** `writer/index.ts` (1587 lignes)
**Fichier test:** `writer/index.test.ts` (2527 lignes, 91 tests)

### Structure Cible
```
writer/
├── index.ts
├── types.ts (inchangé)
├── neo4j-writer.ts             # Classe principale
├── utils/
│   ├── build-fqn.ts + .test.ts
│   ├── extract-type-names.ts + .test.ts
│   └── serialize-type-parameters.ts + .test.ts
├── setup/
│   ├── ensure-constraints-and-indexes.ts + .test.ts
│   └── clear-graph.ts + .test.ts
├── entity-writers/
│   ├── write-file.ts + .test.ts
│   ├── write-project.ts + .test.ts
│   ├── write-packages.ts + .test.ts
│   ├── write-class.ts + .test.ts
│   ├── write-function.ts + .test.ts
│   ├── write-property.ts + .test.ts
│   ├── write-parameter.ts + .test.ts
│   ├── write-type-alias.ts + .test.ts
│   └── write-annotations.ts + .test.ts
├── relationship-writers/
│   ├── write-extends-relationship.ts + .test.ts
│   ├── write-implements-relationship.ts + .test.ts
│   ├── write-resolved-calls.ts + .test.ts
│   └── write-uses-relationships.ts + .test.ts
├── advanced-writers/
│   ├── write-secondary-constructor.ts + .test.ts
│   ├── write-destructuring-declaration.ts + .test.ts
│   └── write-object-expression.ts + .test.ts
└── domain-writers/
    └── write-domains.ts + .test.ts
```

---

## Validation Globale

Après chaque phase :
```bash
npm test        # 672 tests doivent passer
npm run typecheck
npm run build
```
