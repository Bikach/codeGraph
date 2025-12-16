# Rapport d'Analyse : Compatibilité Parser Kotlin ↔ Resolver

**Date** : 2025-12-16
**Version** : Post-améliorations
**Statut** : ✅ Pipeline cohérent et prêt pour le Writer Neo4j

---

## Résumé Exécutif

Le parser Kotlin et le resolver de symboles ont été analysés et améliorés pour assurer une cohérence complète dans le pipeline d'indexation. **324 tests passent**, incluant 17 nouveaux tests d'intégration validant le flux Parser → Resolver.

---

## 1. Améliorations Apportées

### 1.1 Distinction Superclass vs Interface (Parser)

**Fichier** : `src/indexer/parsers/kotlin/extractor.ts:210-247`

**Problème initial** : Toutes les délégations étaient mises dans `interfaces[]`, `superClass` était toujours `undefined`.

**Solution** : Utilisation de la syntaxe Kotlin - les superclasses ont des parenthèses `()` (constructor invocation), les interfaces non.

```kotlin
// Exemple Kotlin
class UserService : BaseService(), Repository, Closeable
//                  ^^^^^^^^^^^^   ^^^^^^^^^^  ^^^^^^^^
//                  superclass     interface   interface
//                  (has parens)   (no parens) (no parens)
```

**Code corrigé** :
```typescript
function extractSuperTypes(classNode: SyntaxNode): { superClass?: string; interfaces: string[] } {
  let superClass: string | undefined;
  const interfaces: string[] = [];

  for (const child of classNode.children) {
    if (child.type === 'delegation_specifier') {
      const constructorInvocation = findChildByType(child, 'constructor_invocation');

      if (constructorInvocation) {
        // Superclass (has constructor call with parentheses)
        superClass = extractTypeName(constructorInvocation);
      } else {
        // Interface (no constructor call)
        interfaces.push(extractTypeName(child));
      }
    }
  }
  return { superClass, interfaces };
}
```

### 1.2 Types Enrichis du Resolver

**Fichier** : `src/indexer/resolver/types.ts`

**Nouveaux types ajoutés** :

```typescript
// ClassSymbol - Classes avec métadonnées Kotlin
interface ClassSymbol extends Symbol {
  kind: 'class' | 'interface' | 'object' | 'enum' | 'annotation';
  superClass?: string;      // FQN de la superclass
  interfaces: string[];     // FQN des interfaces
  isData?: boolean;         // data class
  isSealed?: boolean;       // sealed class
  isAbstract?: boolean;     // abstract class
}

// FunctionSymbol - Fonctions enrichies
interface FunctionSymbol extends Symbol {
  parameterTypes: string[];
  returnType?: string;
  isExtension: boolean;
  isOperator?: boolean;
  isInfix?: boolean;
  isSuspend?: boolean;      // NEW: suspend fun
  isInline?: boolean;       // NEW: inline fun
}

// TypeAliasSymbol - NEW
interface TypeAliasSymbol extends Symbol {
  kind: 'typealias';
  aliasedType: string;      // e.g., "List<String>"
}

// PropertySymbol - NEW
interface PropertySymbol extends Symbol {
  kind: 'property';
  type?: string;
  isVal?: boolean;          // val = immutable
}
```

### 1.3 Support Type Aliases

**Fichier** : `src/indexer/resolver/index.ts:102-114`

Les type aliases sont maintenant :
- Indexés comme `TypeAliasSymbol` avec leur type sous-jacent
- Résolus de manière transparente lors des appels de méthodes

```typescript
// Dans resolveMethodInType()
if (symbol?.kind === 'typealias') {
  const aliasSymbol = symbol as TypeAliasSymbol;
  const underlyingType = aliasSymbol.aliasedType.split('<')[0];
  // Résolution vers le type sous-jacent
}
```

### 1.4 Support Destructuring Declarations

**Fichier** : `src/indexer/resolver/index.ts:117-136`

Chaque composant de destructuring (sauf `_`) est indexé comme propriété :

```kotlin
val (firstName, lastName) = Pair("John", "Doe")
// → PropertySymbol("firstName"), PropertySymbol("lastName")
```

### 1.5 Support Object Expressions

**Fichier** : `src/indexer/resolver/index.ts:138-160`

Les objets anonymes sont indexés avec un FQN basé sur la position :
- FQN : `com.example.<anonymous>@42` (ligne 42)
- Les appels dans leurs fonctions sont résolus

### 1.6 Métadonnées Kotlin Préservées

| Parser (ParsedClass/Function) | Resolver (Symbol) |
|------------------------------|-------------------|
| `isData: boolean` | `ClassSymbol.isData` |
| `isSealed: boolean` | `ClassSymbol.isSealed` |
| `isAbstract: boolean` | `ClassSymbol.isAbstract` |
| `isSuspend: boolean` | `FunctionSymbol.isSuspend` |
| `isInline: boolean` | `FunctionSymbol.isInline` |
| `isInfix: boolean` | `FunctionSymbol.isInfix` |
| `isOperator: boolean` | `FunctionSymbol.isOperator` |

---

## 2. Tableau de Compatibilité Complet

| Aspect | Parser | Resolver | Statut |
|--------|--------|----------|--------|
| ParsedFile structure | ✅ 8 champs | ✅ Tous traités | ✅ |
| Superclass vs Interfaces | ✅ Séparés | ✅ Hiérarchie correcte | ✅ **Corrigé** |
| Métadonnées Classe | ✅ isData/isSealed/isAbstract | ✅ ClassSymbol | ✅ **Nouveau** |
| Métadonnées Fonction | ✅ isSuspend/isInline | ✅ FunctionSymbol | ✅ **Nouveau** |
| Type Aliases | ✅ ParsedTypeAlias | ✅ TypeAliasSymbol | ✅ **Nouveau** |
| Destructuring | ✅ ParsedDestructuring | ✅ Composants indexés | ✅ **Nouveau** |
| Object Expressions | ✅ ParsedObjectExpression | ✅ FQN anonyme | ✅ **Nouveau** |
| Companion Objects | ✅ Nom réel extrait | ✅ User.Companion.method | ✅ |
| Extension Functions | ✅ receiverType | ✅ Matching par type | ✅ |
| Properties avec Types | ✅ ParsedProperty.type | ✅ PropertySymbol.type | ✅ **Nouveau** |

---

## 3. Architecture du Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     PARSER (Kotlin-specific)                    │
│  tree-sitter-kotlin → extractor.ts → ParsedFile                │
│                                                                 │
│  Outputs:                                                       │
│  - packageName, imports                                         │
│  - classes (avec superClass/interfaces séparés)                │
│  - topLevelFunctions, topLevelProperties                       │
│  - typeAliases, destructuringDeclarations, objectExpressions   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RESOLVER (Language-agnostic)                  │
│                                                                 │
│  buildSymbolTable(ParsedFile[]) → SymbolTable                  │
│    - byFqn: Map<string, Symbol>                                │
│    - byName: Map<string, Symbol[]>                             │
│    - functionsByName: Map<string, FunctionSymbol[]>            │
│    - byPackage: Map<string, Symbol[]>                          │
│    - typeHierarchy: Map<string, string[]>                      │
│                                                                 │
│  resolveSymbols(ParsedFile[]) → ResolvedFile[]                 │
│    - 8-priority resolution strategy                            │
│    - Type alias unwrapping                                     │
│    - Hierarchy traversal                                       │
│    - Extension function matching                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WRITER (Neo4j) - TODO                       │
│  ResolvedFile[] → Neo4j Graph                                  │
│  CREATE (n:Class {isData, isSealed, ...})                      │
│  CREATE (f:Function {isSuspend, isInline, ...})                │
│  CREATE (n)-[:CALLS]->(m)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Stratégie de Résolution (8 Priorités)

```
1. Explicit receiver type     → user.save() où user: UserRepository
2. Local variable type        → param.method() où param a un type déclaré
3. Class property type        → this.repository.findById()
4. Static/Companion call      → User.create() → User.Companion.create
5. Same class method          → this.privateMethod() ou unqualified
6. Type hierarchy             → méthode héritée de superclass
7. Imports (explicit+wildcard)→ import com.example.*
8. Extension/Top-level unique → dernier recours
```

---

## 5. Tests

### Statistiques

| Suite | Fichier | Tests | Statut |
|-------|---------|-------|--------|
| Parser Kotlin | `parsers/kotlin/index.test.ts` | 113 | ✅ |
| Resolver | `resolver/index.test.ts` | 41 | ✅ |
| Intégration | `integration.test.ts` | 17 | ✅ |
| **Total** | | **324** | ✅ |

### Scénarios d'Intégration Couverts

1. ✅ Hiérarchie de types avec superclass et interfaces
2. ✅ Résolution de méthodes héritées cross-file
3. ✅ Préservation data class metadata
4. ✅ Préservation sealed class metadata
5. ✅ Préservation suspend function metadata
6. ✅ Préservation inline function metadata
7. ✅ Résolution à travers type aliases
8. ✅ Indexation destructuring components
9. ✅ Skip underscore dans destructuring
10. ✅ Résolution dans object expressions
11. ✅ Résolution companion object calls
12. ✅ Named companion objects
13. ✅ Extension function resolution
14. ✅ Property type inference pour receivers
15. ✅ Statistiques de résolution
16. ✅ Résolution cross-file (3 fichiers, 3 packages)
17. ✅ Pattern matching avec findSymbols()

### Gaps Identifiés (Tests Manquants)

| Gap | Priorité | Description |
|-----|----------|-------------|
| Overload resolution | 🔴 Haute | Même nom, params différents |
| Nullable types | 🔴 Haute | `user?.getName()` safe calls |
| Qualified calls | 🟡 Moyenne | `com.example.Service.method()` |
| Constructor calls | 🟡 Moyenne | `User()` vs méthode |
| Lambda/closures | 🟡 Moyenne | Scope capture |
| Operator/Infix | 🟢 Basse | `a + b`, `a to b` |
| Circular deps | 🟢 Basse | A → B → A |

---

## 6. Fichiers Modifiés

```
mcp-server/src/indexer/
├── parsers/kotlin/
│   ├── extractor.ts          # extractSuperTypes() corrigé
│   └── index.test.ts         # +1 test, 1 test mis à jour
├── resolver/
│   ├── types.ts              # +4 nouveaux types (ClassSymbol, etc.)
│   └── index.ts              # Indexation enrichie, type alias resolution
├── integration.test.ts       # NOUVEAU: 17 tests d'intégration
└── types.ts                  # (inchangé)
```

---

## 7. Prochaines Étapes Recommandées

### Haute Priorité
1. **Implémenter le Writer Neo4j** - Persister les `ResolvedFile[]` dans le graphe
2. **Enrichir SCHEMA.md** - Ajouter les nouvelles propriétés (isData, isSuspend, etc.)
3. **Tests overloading** - Ajouter des tests pour la résolution avec surcharge

### Moyenne Priorité
4. **Tests nullable** - Ajouter des tests pour les safe calls (`?.`)
5. **Tests constructeurs** - Distinguer `User()` constructeur vs méthode
6. **CLI d'indexation** - Créer la commande pour indexer un codebase

### Basse Priorité
7. **Autres parsers** - Java, TypeScript (même architecture)
8. **Tests de performance** - Sur de gros codebases

---

## 8. Commandes Utiles

```bash
# Lancer tous les tests
cd mcp-server && npm test

# Lancer uniquement les tests d'intégration
npm test -- --run src/indexer/integration.test.ts

# Vérifier la compilation TypeScript
npm run typecheck

# Build production
npm run build
```

---

## Conclusion

Le pipeline Parser → Resolver est **cohérent, testé et prêt** pour l'étape suivante : l'écriture dans Neo4j. Les améliorations apportées garantissent que toutes les métadonnées Kotlin importantes sont préservées à travers le pipeline, permettant des requêtes riches sur le graphe de code.
