# Plan: Implémentation du Parser Java pour CodeGraph

## Objectif
Créer un parser Java complet pour le serveur MCP CodeGraph, avec parité fonctionnelle avec le parser Kotlin existant et une suite de tests exhaustive (~145 tests).

---

## Structure des fichiers à créer

```
mcp-server/src/indexer/parsers/java/
├── parser.ts        (~40 lignes)   - Initialisation tree-sitter singleton
├── extractor.ts     (~1200 lignes) - Logique d'extraction AST
├── index.ts         (~80 lignes)   - Implémentation LanguageParser
└── index.test.ts    (~60KB)        - Suite de tests (~145 tests)
```

---

## Phase 1: Fondation

### 1.1 Installer la dépendance
```bash
cd mcp-server && npm install tree-sitter-java
```

### 1.2 Créer `parser.ts`
- Pattern singleton identique à `parsers/kotlin/parser.ts`
- Exporter `parseJava(source: string): Tree`
- Exporter `getParser(): Parser`

### 1.3 Créer `index.ts`
- Implémenter `LanguageParser` interface
- `language: 'java'`, `extensions: ['.java']`
- Fonction `setFilePathInLocations()` (copier pattern Kotlin)

### 1.4 Mettre à jour `registry.ts`
- Décommenter lignes 135-138 pour enregistrer le parser Java

---

## Phase 2: Extraction de base

### 2.1 Créer `extractor.ts` avec fonctions de base
| Fonction | Responsabilité |
|----------|----------------|
| `extractSymbols(tree, filePath)` | Point d'entrée principal |
| `extractPackageName(root)` | Extraire `package com.example;` |
| `extractImports(root)` | Imports simples, wildcard, **static** |
| `findChildByType(node, type)` | Helper de navigation AST |
| `nodeLocation(node)` | Créer SourceLocation |

### 2.2 Modification types.ts (optionnel)
Ajouter `isStatic?: boolean` à `ParsedImport` pour les imports statiques Java:
```typescript
export interface ParsedImport {
  path: string;
  alias?: string;
  isWildcard: boolean;
  isStatic?: boolean;  // NOUVEAU
}
```

---

## Phase 3: Extraction des classes

### 3.1 Fonctions d'extraction de classes
| Fonction | Node types gérés |
|----------|------------------|
| `extractClass(node)` | `class_declaration` |
| `extractInterface(node)` | `interface_declaration` |
| `extractEnum(node)` | `enum_declaration` |
| `extractAnnotationType(node)` | `annotation_type_declaration` |
| `extractRecord(node)` | `record_declaration` (Java 16+) |

### 3.2 Fonctions de support
| Fonction | Responsabilité |
|----------|----------------|
| `extractModifiers(node)` | Visibilité, abstract, final, static, sealed |
| `extractAnnotations(node)` | `@Annotation(args)` |
| `extractTypeParameters(node)` | `<T extends Bound>` |
| `extractSuperTypes(node)` | extends/implements |

### 3.3 Mapping visibilité Java → ParsedClass
| Java | ParsedClass.visibility |
|------|------------------------|
| `public` | `'public'` |
| `private` | `'private'` |
| `protected` | `'protected'` |
| (aucun) | `'internal'` (package-private) |

---

## Phase 4: Extraction des membres

### 4.1 Méthodes
| Fonction | Responsabilité |
|----------|----------------|
| `extractMethod(node)` | `method_declaration` |
| `extractParameters(node)` | `formal_parameters` |
| `extractReturnType(node)` | Type de retour ou `void` |

### 4.2 Champs/Propriétés
| Fonction | Responsabilité |
|----------|----------------|
| `extractField(node)` | `field_declaration` |
| `splitMultipleDeclarators()` | `int a, b, c;` → 3 propriétés |

**Note**: `final` → `isVal: true`, sinon `isVal: false`

### 4.3 Constructeurs
| Fonction | Responsabilité |
|----------|----------------|
| `extractConstructor(node)` | `constructor_declaration` |
| `extractDelegation(node)` | Détecter `this()` ou `super()` |

---

## Phase 5: Extraction des appels de fonction

### 5.1 Fonctions d'extraction des appels
| Fonction | Node types gérés |
|----------|------------------|
| `extractCalls(body)` | Traverser le corps de méthode |
| `extractMethodInvocation(node)` | `method_invocation` |
| `extractConstructorCall(node)` | `object_creation_expression` |

### 5.2 Mapping des appels
| Pattern Java | ParsedCall |
|--------------|------------|
| `obj.method()` | `{name: 'method', receiver: 'obj'}` |
| `method()` | `{name: 'method'}` |
| `Class.staticMethod()` | `{name: 'staticMethod', receiver: 'Class'}` |
| `new User()` | `{name: 'User', isConstructorCall: true}` |
| `super.method()` | `{name: 'method', receiver: 'super'}` |

---

## Phase 6: Fonctionnalités avancées

### 6.1 Classes imbriquées
- Static nested classes
- Inner classes (non-static)
- Anonymous inner classes → `name: '<anonymous>'`
- Local classes dans méthodes

### 6.2 Énumérations complètes
- Constantes d'enum avec arguments
- Méthodes et champs d'enum
- Enum implémentant interface

### 6.3 Records (Java 16+)
- Composants → `properties`
- `isData: true`
- Constructeur compact

### 6.4 Génériques avancés
- Bounds multiples: `<T extends A & B>`
- Wildcards: `<? extends Number>`, `<? super Integer>`
- Bounds récursifs: `<T extends Comparable<T>>`

---

## Phase 7: Tests (~145 tests)

### Catégories de tests
| Catégorie | Tests | Priorité |
|-----------|-------|----------|
| Metadata | 3 | P0 |
| Package | 2 | P0 |
| Imports (+ static) | 8 | P0 |
| Classes/Interfaces/Enums | 15 | P0 |
| Héritage | 8 | P0 |
| Méthodes | 18 | P0 |
| Champs | 12 | P0 |
| Constructeurs | 10 | P1 |
| Appels de fonctions | 18 | P1 |
| Classes imbriquées | 8 | P1 |
| Génériques | 10 | P2 |
| Annotations | 8 | P2 |
| Énums spécifiques | 6 | P2 |
| Records (Java 16+) | 8 | P2 |
| Sealed Classes (Java 17+) | 5 | P2 |
| Switch Expressions (Java 14+) | 5 | P2 |
| Pattern Matching (Java 21+) | 6 | P2 |
| Source location | 3 | P2 |

### Tests Java moderne (détail)

#### Records (Java 16+) - 8 tests
```typescript
describe('records (Java 16+)', () => {
  it('should extract record as class with isData: true');
  it('should extract record components as properties');
  it('should mark record properties as isVal: true');
  it('should extract record implementing interface');
  it('should extract compact constructor');
  it('should extract canonical constructor');
  it('should extract record with generic type parameters');
  it('should extract record with additional methods');
});
```

#### Sealed Classes (Java 17+) - 5 tests
```typescript
describe('sealed classes (Java 17+)', () => {
  it('should extract sealed class with isSealed: true');
  it('should extract permits clause');
  it('should extract final subclass');
  it('should extract non-sealed subclass');
  it('should extract sealed interface');
});
```

#### Switch Expressions (Java 14+) - 5 tests
```typescript
describe('switch expressions (Java 14+)', () => {
  it('should extract calls in switch expression branches');
  it('should extract calls in arrow case labels');
  it('should extract calls in yield statements');
  it('should handle multiple case labels');
  it('should extract calls in switch with patterns');
});
```

#### Pattern Matching (Java 21+) - 6 tests
```typescript
describe('pattern matching (Java 21+)', () => {
  it('should extract calls on pattern-bound variables in instanceof');
  it('should extract calls in switch pattern cases');
  it('should handle record patterns');
  it('should handle guarded patterns (when clause)');
  it('should handle null case in switch');
  it('should handle unnamed patterns (_)');
});
```

---

## Fichiers critiques à modifier/créer

### Nouveaux fichiers
- `mcp-server/src/indexer/parsers/java/parser.ts`
- `mcp-server/src/indexer/parsers/java/extractor.ts`
- `mcp-server/src/indexer/parsers/java/index.ts`
- `mcp-server/src/indexer/parsers/java/index.test.ts`

### Fichiers à modifier
- `mcp-server/src/indexer/parsers/registry.ts` (décommenter Java)
- `mcp-server/src/indexer/types.ts` (ajouter `isStatic` à ParsedImport)
- `mcp-server/package.json` (ajouter `tree-sitter-java`)

### Fichiers de référence (lecture seule)
- `mcp-server/src/indexer/parsers/kotlin/parser.ts` - Pattern tree-sitter
- `mcp-server/src/indexer/parsers/kotlin/extractor.ts` - Patterns d'extraction
- `mcp-server/src/indexer/parsers/kotlin/index.test.ts` - Structure des tests
- `mcp-server/src/indexer/resolver/stdlib/java-stdlib.ts` - Stdlib déjà prêt

---

## Ordre d'implémentation recommandé

1. **Fondation**: parser.ts, index.ts, registry.ts, dépendance npm
2. **Package/Imports**: extractPackageName, extractImports (avec static)
3. **Classes de base**: extractClass, extractModifiers, extractAnnotations
4. **Héritage**: extractSuperTypes (extends/implements)
5. **Méthodes**: extractMethod, extractParameters
6. **Champs**: extractField avec gestion multi-déclarateurs
7. **Constructeurs**: extractConstructor avec délégation
8. **Appels**: extractCalls, extractMethodInvocation
9. **Génériques**: extractTypeParameters avec bounds
10. **Avancé**: nested classes, enums, records, anonymous classes
11. **Tests**: En parallèle avec chaque phase

---

## Fonctionnalités Java modernes à supporter

### Par version (basé sur Context7 / Oracle docs)

| Version | Fonctionnalité | JEP | Support dans parser |
|---------|----------------|-----|---------------------|
| **Java 14** | Switch Expressions | JEP 361 | Extraire appels dans `->` |
| **Java 15** | Text Blocks (`"""`) | JEP 378 | Strings multilignes |
| **Java 16** | Records | JEP 395 | `record_declaration` |
| **Java 16** | Pattern Matching instanceof | JEP 394 | `instanceof` avec binding |
| **Java 17** | Sealed Classes | JEP 409 | `sealed`, `permits` clause |
| **Java 21** | Record Patterns | JEP 440 | Patterns dans switch/instanceof |
| **Java 21** | Pattern Matching switch | JEP 441 | Case patterns |
| **Java 22** | Unnamed Variables | JEP 456 | `_` dans patterns |
| **Java 25** | Primitive Types in Patterns | Preview | `case int i` |

### Détails d'implémentation

#### 1. Switch Expressions (Java 14+)
```java
String result = switch (day) {
    case MONDAY, FRIDAY -> "Work";
    case SATURDAY, SUNDAY -> "Rest";
    default -> throw new IllegalArgumentException();
};
```
**Action** : Extraire les appels de fonction dans les branches `->` et `yield`

#### 2. Text Blocks (Java 15+)
```java
String json = """
    {
        "name": "test"
    }
    """;
```
**Action** : Gérer `text_block` node type (pas d'impact sur extraction de symboles)

#### 3. Records (Java 16+)
```java
public record Point(int x, int y) implements Serializable {
    public Point { // compact constructor
        if (x < 0) throw new IllegalArgumentException();
    }
}
```
**Action** :
- Node type: `record_declaration`
- Composants → `properties` avec `isVal: true`
- `isData: true` sur ParsedClass
- Compact constructor support

#### 4. Pattern Matching instanceof (Java 16+)
```java
if (obj instanceof String s) {
    System.out.println(s.length());
}
```
**Action** : Extraire les appels sur la variable bindée (`s.length()`)

#### 5. Sealed Classes (Java 17+)
```java
public sealed class Shape permits Circle, Rectangle, Square { }
public final class Circle extends Shape { }
public non-sealed class Rectangle extends Shape { }
```
**Action** :
- `isSealed: true` sur ParsedClass
- Extraire `permits` clause (optionnel, pour info)
- Gérer `final` et `non-sealed` modifiers

#### 6. Pattern Matching switch (Java 21+)
```java
return switch (obj) {
    case Integer i -> i * 2;
    case String s -> s.length();
    case null, default -> 0;
};
```
**Action** : Extraire appels dans chaque branche de pattern

#### 7. Record Patterns (Java 21+)
```java
if (obj instanceof Point(int x, int y)) {
    return x + y;
}
```
**Action** : Gérer les patterns déstructurés (extraction des appels dans le scope)

#### 8. Unnamed Variables (Java 22+)
```java
try (var _ = ScopedValue.where(KEY, value).call(() -> { })) { }
for (var _ : list) { count++; }
```
**Action** : Ignorer `_` comme nom de variable (pas d'impact majeur)

---

## Différences clés Java vs Kotlin

| Aspect | Kotlin | Java |
|--------|--------|------|
| Top-level functions | ✅ | ❌ |
| Extension functions | ✅ | ❌ |
| Data classes | `data class` | `record` (Java 16+) |
| Null safety | `?.` safe call | N/A |
| Visibility par défaut | `public` | package-private |
| Immutabilité | `val`/`var` | `final` |
| Objects | `object` | N/A |
| Static imports | N/A | `import static` |
| Companion objects | ✅ | Static members |
| Sealed classes | `sealed class` | `sealed class` (Java 17+) |
| Pattern matching | `when` expression | `switch` patterns (Java 21+) |
| Switch expressions | `when` | `switch ->` (Java 14+) |
| Text blocks | `"""` multiline | `"""` (Java 15+) |

---

## Tree-sitter Java Node Types Reference

### Declaration Nodes
| Node Type | Java Construct |
|-----------|----------------|
| `program` | Root node |
| `package_declaration` | `package com.example;` |
| `import_declaration` | `import ...;` |
| `class_declaration` | `class Name { }` |
| `interface_declaration` | `interface Name { }` |
| `enum_declaration` | `enum Name { }` |
| `annotation_type_declaration` | `@interface Name { }` |
| `record_declaration` | `record Name(...) { }` |

### Member Nodes
| Node Type | Java Construct |
|-----------|----------------|
| `method_declaration` | Method definitions |
| `constructor_declaration` | Constructor definitions |
| `field_declaration` | Field definitions |
| `constant_declaration` | Interface constants |
| `enum_constant` | Enum values |

### Expression Nodes (for call extraction)
| Node Type | Java Construct |
|-----------|----------------|
| `method_invocation` | `obj.method()` |
| `object_creation_expression` | `new Class()` |
| `field_access` | `obj.field` |
| `switch_expression` | `switch (...) { }` |

### Modifier Nodes
| Node Type | Values |
|-----------|--------|
| `modifiers` | Container |
| Visibility | `public`, `private`, `protected` |
| Class | `abstract`, `final`, `static`, `sealed`, `non-sealed` |
| Method | `synchronized`, `native`, `default` |
