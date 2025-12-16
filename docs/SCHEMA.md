# Neo4j Schema for Kotlin Code Analysis

This document describes the Neo4j graph model for analyzing and exploring Kotlin projects.

## Table of Contents

- [Nodes (Labels)](#nodes-labels)
- [Relationships](#relationships)
- [Node Properties](#node-properties)
- [Relationship Properties](#relationship-properties)
- [Constraints and Indexes](#constraints-and-indexes)
- [Useful Cypher Queries](#useful-cypher-queries)

---

## Nodes (Labels)

### Package
Represents a Kotlin package.

**Properties:**
- `name`: String - Full package name (e.g., `com.example.domain`)
- `path`: String - Package path in the file system

### Class
Represents a Kotlin class.

**Properties:**
- `fqn`: String - Fully qualified name (e.g., `com.example.UserService`)
- `name`: String - Simple class name
- `visibility`: String - Visibility (`public`, `private`, `protected`, `internal`)
- `isAbstract`: Boolean - Indicates if the class is abstract
- `isData`: Boolean - Indicates if it's a data class
- `isSealed`: Boolean - Indicates if it's a sealed class
- `superClass`: String (optional) - Superclass name
- `interfaces`: String[] - Implemented interfaces
- `typeParameters`: String[] (optional) - Generic type parameters
- `filePath`: String - Source file path
- `lineNumber`: Integer - Declaration line number

### Interface
Represents a Kotlin interface.

**Properties:**
- `fqn`: String - Fully qualified name
- `name`: String - Simple interface name
- `visibility`: String - Visibility (`public`, `private`, `protected`, `internal`)
- `isSealed`: Boolean - Indicates if it's a sealed interface
- `interfaces`: String[] - Extended interfaces
- `typeParameters`: String[] (optional) - Generic type parameters
- `filePath`: String - Source file path
- `lineNumber`: Integer - Declaration line number

### Object
Represents a Kotlin object (singleton or companion object).

**Properties:**
- `fqn`: String - Fully qualified name
- `name`: String - Object name (or "Companion" for anonymous companion objects)
- `visibility`: String - Visibility (`public`, `private`, `protected`, `internal`)
- `isCompanion`: Boolean - Indicates if it's a companion object
- `parentClass`: String (optional) - Parent class for companion objects
- `filePath`: String - Source file path
- `lineNumber`: Integer - Declaration line number

### Function
Represents a Kotlin function.

**Properties:**
- `fqn`: String - Fully qualified name (e.g., `com.example.UserService.save`)
- `name`: String - Function name
- `visibility`: String - Visibility (`public`, `private`, `protected`, `internal`)
- `isExtension`: Boolean - Indicates if it's an extension function
- `isSuspend`: Boolean - Indicates if it's a suspend function (coroutine)
- `isInline`: Boolean - Indicates if it's an inline function
- `isInfix`: Boolean - Indicates if it's an infix function
- `isOperator`: Boolean - Indicates if it's an operator function
- `isAbstract`: Boolean - Indicates if it's an abstract function
- `receiverType`: String (optional) - Receiver type for extension functions
- `returnType`: String - Function return type
- `typeParameters`: String[] (optional) - Generic type parameters
- `declaringType`: String - FQN of the declaring class/interface/object
- `filePath`: String - Source file path
- `lineNumber`: Integer - Declaration line number

### Property
Represents a Kotlin property.

**Properties:**
- `fqn`: String - Fully qualified name
- `name`: String - Property name
- `visibility`: String - Visibility (`public`, `private`, `protected`, `internal`)
- `isMutable`: Boolean - Indicates if it's a `var` (true) or `val` (false)
- `type`: String - Property type
- `initializer`: String (optional) - Initializer expression (for delegated properties like `by lazy`)
- `declaringType`: String - FQN of the declaring class/interface/object
- `filePath`: String - Source file path
- `lineNumber`: Integer - Declaration line number

### Parameter
Represents a function parameter.

**Properties:**
- `name`: String - Parameter name
- `type`: String - Parameter type
- `hasDefault`: Boolean - Indicates if the parameter has a default value
- `isCrossinline`: Boolean (optional) - For inline function lambda parameters
- `isNoinline`: Boolean (optional) - For inline function lambda parameters
- `functionType`: Object (optional) - For lambda parameters, contains `parameterTypes`, `returnType`, `receiverType`, `isSuspend`

### Annotation
Represents a Kotlin annotation.

**Properties:**
- `name`: String - Annotation name (e.g., `@Override`, `@Deprecated`)
- `arguments`: Object (optional) - Annotation arguments as key-value pairs

### TypeAlias
Represents a Kotlin type alias.

**Properties:**
- `fqn`: String - Fully qualified name
- `name`: String - Alias name
- `aliasedType`: String - The type being aliased
- `visibility`: String - Visibility
- `typeParameters`: String[] (optional) - Generic type parameters
- `filePath`: String - Source file path
- `lineNumber`: Integer - Declaration line number

---

## Relationships

### CONTAINS
Links a package to its elements (classes, interfaces, objects).

**Direction:** `Package -> Class | Interface | Object`

**Properties:** None

### DECLARES
Links a type (class, interface, object) to its members (functions, properties).

**Direction:** `Class | Interface | Object -> Function | Property`

**Properties:** None

### EXTENDS
Links a class to its parent class.

**Direction:** `Class -> Class`

**Properties:** None

### IMPLEMENTS
Links a class to an interface it implements.

**Direction:** `Class -> Interface`

**Properties:** None

### CALLS
Links a function that calls another function.

**Direction:** `Function -> Function`

**Properties:**
- `count`: Integer (optional) - Number of calls within the function
- `isSafeCall`: Boolean (optional) - True if using `?.` operator
- `receiver`: String (optional) - Receiver expression (e.g., "repository", "com.example.Utils")
- `argumentCount`: Integer (optional) - Number of arguments passed
- `argumentTypes`: String[] (optional) - Inferred types of arguments

### USES
Links a function to a type it uses (class or interface).

**Direction:** `Function -> Class | Interface`

**Properties:**
- `context`: String (optional) - Usage context (`parameter`, `returnType`, `localVariable`, `dependency`)

### HAS_PARAMETER
Links a function to its parameters.

**Direction:** `Function -> Parameter`

**Properties:**
- `position`: Integer - Parameter position (starts at 0)

### ANNOTATED_WITH
Links an element to its annotations.

**Direction:** `Class | Function | Property -> Annotation`

**Properties:** None

### RETURNS
Links a function to the type it returns.

**Direction:** `Function -> Class | Interface`

**Properties:** None

---

## Node Properties

### Common Properties

All code nodes (Class, Interface, Object, Function, Property) share:
- `filePath`: Source file path
- `lineNumber`: Line number
- `visibility`: Visibility level

### Specific Properties

#### Class
- Supports inheritance and interface implementation
- Can be abstract, data class, or sealed

#### Function
- Can be an extension function
- Can be suspend for coroutines
- Has an explicit return type

#### Property
- Distinction between `var` (mutable) and `val` (immutable)

---

## Constraints and Indexes

### Uniqueness Constraints

```cypher
// Constraint on full package name
CREATE CONSTRAINT package_name_unique IF NOT EXISTS
FOR (p:Package) REQUIRE p.name IS UNIQUE;

// Constraint on full class name (package + name)
CREATE CONSTRAINT class_unique IF NOT EXISTS
FOR (c:Class) REQUIRE (c.name, c.filePath) IS UNIQUE;

// Constraint on interface name
CREATE CONSTRAINT interface_unique IF NOT EXISTS
FOR (i:Interface) REQUIRE (i.name, i.filePath) IS UNIQUE;

// Constraint on annotation name
CREATE CONSTRAINT annotation_name_unique IF NOT EXISTS
FOR (a:Annotation) REQUIRE a.name IS UNIQUE;
```

### Performance Indexes

```cypher
// Index on names for fast lookups
CREATE INDEX class_name_index IF NOT EXISTS FOR (c:Class) ON (c.name);
CREATE INDEX function_name_index IF NOT EXISTS FOR (f:Function) ON (f.name);
CREATE INDEX property_name_index IF NOT EXISTS FOR (p:Property) ON (p.name);

// Index on file paths
CREATE INDEX class_file_index IF NOT EXISTS FOR (c:Class) ON (c.filePath);
CREATE INDEX function_file_index IF NOT EXISTS FOR (f:Function) ON (f.filePath);

// Index on visibility
CREATE INDEX class_visibility_index IF NOT EXISTS FOR (c:Class) ON (c.visibility);
CREATE INDEX function_visibility_index IF NOT EXISTS FOR (f:Function) ON (f.visibility);
```

---

## Useful Cypher Queries

### 1. Find all implementations of an interface

```cypher
// Find all classes that implement a specific interface
MATCH (i:Interface {name: 'Repository'})<-[:IMPLEMENTS]-(c:Class)
RETURN c.name AS className, c.filePath AS file, c.lineNumber AS line
ORDER BY c.name;

// With classes that extend those implementations
MATCH (i:Interface {name: 'Repository'})<-[:IMPLEMENTS]-(c:Class)
OPTIONAL MATCH (c)<-[:EXTENDS*]-(subClass:Class)
RETURN c.name AS baseClass, collect(DISTINCT subClass.name) AS implementations
ORDER BY c.name;
```

### 2. Find class dependencies

```cypher
// Direct dependencies (used classes)
MATCH (c:Class {name: 'UserService'})-[:DECLARES]->(f:Function)-[:USES]->(dep:Class)
RETURN DISTINCT dep.name AS dependency, dep.filePath AS file
ORDER BY dep.name;

// Complete dependencies (includes interfaces and return types)
MATCH (c:Class {name: 'UserService'})
MATCH (c)-[:DECLARES]->(f:Function)
OPTIONAL MATCH (f)-[:USES]->(usedClass:Class)
OPTIONAL MATCH (f)-[:RETURNS]->(returnClass:Class)
OPTIONAL MATCH (f)-[:HAS_PARAMETER]->(p:Parameter)
OPTIONAL MATCH (i:Interface)<-[:IMPLEMENTS]-(c)
RETURN DISTINCT
  collect(DISTINCT usedClass.name) AS usedClasses,
  collect(DISTINCT returnClass.name) AS returnTypes,
  collect(DISTINCT p.type) AS parameterTypes,
  collect(DISTINCT i.name) AS implementedInterfaces;

// Dependency tree (depth 3)
MATCH path = (c:Class {name: 'UserService'})-[:DECLARES]->()-[:USES|RETURNS*1..3]->(dep)
WHERE dep:Class OR dep:Interface
RETURN path
LIMIT 100;
```

### 3. Find functions that call a given function

```cypher
// Direct callers
MATCH (caller:Function)-[:CALLS]->(target:Function {name: 'validateUser'})
MATCH (owner)-[:DECLARES]->(caller)
RETURN
  owner.name AS ownerClass,
  caller.name AS callerFunction,
  caller.filePath AS file,
  caller.lineNumber AS line
ORDER BY owner.name, caller.name;

// Call chain (who calls what, recursively)
MATCH path = (start:Function)-[:CALLS*1..5]->(target:Function {name: 'validateUser'})
RETURN [node IN nodes(path) | node.name] AS callChain
ORDER BY length(path)
LIMIT 20;

// Usage statistics
MATCH (target:Function {name: 'validateUser'})<-[:CALLS]-(caller:Function)
RETURN
  count(caller) AS numberOfCallers,
  collect(DISTINCT caller.name) AS callers;
```

### 4. Find unused classes

```cypher
// Classes with no references (no USES, EXTENDS, or IMPLEMENTS)
MATCH (c:Class)
WHERE NOT (c)<-[:USES]-()
  AND NOT (c)<-[:EXTENDS]-()
  AND NOT (c:Interface)<-[:IMPLEMENTS]-()
  AND NOT (c)-[:EXTENDS]->()
RETURN c.name AS unusedClass, c.filePath AS file, c.lineNumber AS line
ORDER BY c.name;

// Classes used only within their own package
MATCH (pkg:Package)-[:CONTAINS]->(c:Class)
WHERE NOT EXISTS {
  MATCH (otherPkg:Package)-[:CONTAINS]->()-[:DECLARES]->()-[:USES]->(c)
  WHERE otherPkg <> pkg
}
RETURN c.name AS internalClass, pkg.name AS package
ORDER BY pkg.name, c.name;

// Classes with no subclasses (leaves of the inheritance tree)
MATCH (c:Class)
WHERE NOT (c)<-[:EXTENDS]-()
RETURN c.name AS leafClass, c.isAbstract AS isAbstract, c.filePath AS file
ORDER BY c.name;
```

### 5. Analyze project architecture

```cypher
// Package overview and size
MATCH (pkg:Package)-[:CONTAINS]->(entity)
WHERE entity:Class OR entity:Interface OR entity:Object
RETURN
  pkg.name AS package,
  count(entity) AS numberOfEntities,
  size([e IN collect(entity) WHERE e:Class]) AS classes,
  size([e IN collect(entity) WHERE e:Interface]) AS interfaces,
  size([e IN collect(entity) WHERE e:Object]) AS objects
ORDER BY numberOfEntities DESC;

// Most coupled classes (depend on many others)
MATCH (c:Class)-[:DECLARES]->()-[:USES]->(dep:Class)
RETURN
  c.name AS class,
  count(DISTINCT dep) AS dependencies,
  collect(DISTINCT dep.name) AS dependsOn
ORDER BY dependencies DESC
LIMIT 10;

// Most used classes (many depend on them)
MATCH (c:Class)<-[:USES]-()-[:DECLARES]-(dependent:Class)
RETURN
  c.name AS class,
  count(DISTINCT dependent) AS usedBy,
  collect(DISTINCT dependent.name) AS dependents
ORDER BY usedBy DESC
LIMIT 10;
```

### 6. Analyze code patterns

```cypher
// Find all data classes
MATCH (c:Class {isData: true})
RETURN c.name AS dataClass, c.filePath AS file
ORDER BY c.name;

// Find all suspend functions (coroutines)
MATCH (f:Function {isSuspend: true})
MATCH (owner)-[:DECLARES]->(f)
RETURN
  owner.name AS class,
  f.name AS suspendFunction,
  f.returnType AS returnType
ORDER BY owner.name, f.name;

// Find companion objects
MATCH (o:Object {isCompanion: true})
MATCH (c:Class)-[:DECLARES]->(o)
RETURN c.name AS class, o.name AS companionObject
ORDER BY c.name;

// Sealed classes and their subclasses
MATCH (sealed:Class {isSealed: true})
OPTIONAL MATCH (sealed)<-[:EXTENDS]-(subclass:Class)
RETURN
  sealed.name AS sealedClass,
  collect(subclass.name) AS subclasses
ORDER BY sealed.name;
```

### 7. Analyze annotations

```cypher
// Classes with a specific annotation
MATCH (c:Class)-[:ANNOTATED_WITH]->(a:Annotation {name: '@Deprecated'})
RETURN c.name AS deprecatedClass, c.filePath AS file
ORDER BY c.name;

// Most used annotations
MATCH (a:Annotation)<-[:ANNOTATED_WITH]-(entity)
RETURN
  a.name AS annotation,
  count(entity) AS usage,
  labels(entity)[0] AS entityType
ORDER BY usage DESC;

// Functions with multiple annotations
MATCH (f:Function)-[:ANNOTATED_WITH]->(a:Annotation)
WITH f, collect(a.name) AS annotations
WHERE size(annotations) > 1
MATCH (owner)-[:DECLARES]->(f)
RETURN
  owner.name AS class,
  f.name AS function,
  annotations
ORDER BY size(annotations) DESC;
```

### 8. Analyze complexity

```cypher
// Functions with the most parameters
MATCH (f:Function)-[rel:HAS_PARAMETER]->(p:Parameter)
WITH f, count(p) AS paramCount, collect(p.type) AS paramTypes
WHERE paramCount > 3
MATCH (owner)-[:DECLARES]->(f)
RETURN
  owner.name AS class,
  f.name AS function,
  paramCount,
  paramTypes
ORDER BY paramCount DESC
LIMIT 10;

// Classes with the most methods
MATCH (c:Class)-[:DECLARES]->(f:Function)
WITH c, count(f) AS methodCount
WHERE methodCount > 5
RETURN
  c.name AS class,
  methodCount,
  c.filePath AS file
ORDER BY methodCount DESC
LIMIT 10;

// Maximum inheritance depth
MATCH path = (c:Class)-[:EXTENDS*]->(parent:Class)
WITH c, length(path) AS depth
ORDER BY depth DESC
LIMIT 10
RETURN c.name AS class, depth AS inheritanceDepth;
```

### 9. Search for anti-patterns

```cypher
// Classes that extend AND implement (potential God Object)
MATCH (c:Class)-[:EXTENDS]->(:Class)
MATCH (c)-[:IMPLEMENTS]->(:Interface)
MATCH (c)-[:DECLARES]->(m)
WHERE m:Function OR m:Property
WITH c, count(m) AS memberCount
WHERE memberCount > 10
RETURN
  c.name AS potentialGodObject,
  memberCount,
  c.filePath AS file
ORDER BY memberCount DESC;

// Functions that call too many other functions (Feature Envy)
MATCH (f:Function)-[:CALLS]->(called:Function)
WITH f, count(called) AS callCount
WHERE callCount > 5
MATCH (owner)-[:DECLARES]->(f)
RETURN
  owner.name AS class,
  f.name AS function,
  callCount
ORDER BY callCount DESC
LIMIT 10;

// Classes without public methods (potential Dead Code)
MATCH (c:Class)-[:DECLARES]->(m)
WHERE m:Function OR m:Property
WITH c, collect(m.visibility) AS visibilities
WHERE NONE(v IN visibilities WHERE v = 'public')
RETURN
  c.name AS class,
  c.filePath AS file
ORDER BY c.name;
```

### 10. Package exploration

```cypher
// Dependencies between packages
MATCH (pkg1:Package)-[:CONTAINS]->(c1:Class)-[:DECLARES]->()-[:USES]->(c2:Class)<-[:CONTAINS]-(pkg2:Package)
WHERE pkg1 <> pkg2
RETURN
  pkg1.name AS fromPackage,
  pkg2.name AS toPackage,
  count(*) AS dependencies
ORDER BY dependencies DESC;

// Most autonomous packages (few external dependencies)
MATCH (pkg:Package)-[:CONTAINS]->(entity)
OPTIONAL MATCH (entity)-[:DECLARES]->()-[:USES]->(external)<-[:CONTAINS]-(externalPkg:Package)
WHERE externalPkg <> pkg
WITH pkg, count(entity) AS entities, count(DISTINCT externalPkg) AS externalDeps
RETURN
  pkg.name AS package,
  entities,
  externalDeps,
  CASE WHEN entities > 0 THEN toFloat(externalDeps) / entities ELSE 0 END AS couplingRatio
ORDER BY couplingRatio ASC;
```

---

## Data Examples

### Creation Example

```cypher
// Create a package
CREATE (pkg:Package {name: 'com.example.domain', path: '/src/main/kotlin/com/example/domain'})

// Create an interface
CREATE (repo:Interface {
  name: 'UserRepository',
  visibility: 'public',
  filePath: '/src/main/kotlin/com/example/domain/UserRepository.kt',
  lineNumber: 5
})

// Create a class that implements the interface
CREATE (impl:Class {
  name: 'UserRepositoryImpl',
  visibility: 'public',
  isAbstract: false,
  isData: false,
  isSealed: false,
  filePath: '/src/main/kotlin/com/example/infrastructure/UserRepositoryImpl.kt',
  lineNumber: 10
})

// Create a function
CREATE (func:Function {
  name: 'findById',
  visibility: 'public',
  isExtension: false,
  isSuspend: true,
  returnType: 'User?',
  filePath: '/src/main/kotlin/com/example/infrastructure/UserRepositoryImpl.kt',
  lineNumber: 15
})

// Create a parameter
CREATE (param:Parameter {name: 'id', type: 'Long', hasDefault: false})

// Create relationships
CREATE (pkg)-[:CONTAINS]->(repo)
CREATE (pkg)-[:CONTAINS]->(impl)
CREATE (impl)-[:IMPLEMENTS]->(repo)
CREATE (impl)-[:DECLARES]->(func)
CREATE (func)-[:HAS_PARAMETER {position: 0}]->(param)
```

---

## Best Practices

### 1. Naming
- Use full names for classes and interfaces (including package if necessary)
- File paths should be absolute or relative to the project root

### 2. Performance
- Create indexes on frequently searched properties
- Use LIMIT for exploratory queries
- Profile complex queries with EXPLAIN and PROFILE

### 3. Maintenance
- Update the graph incrementally on code changes
- Remove orphan nodes regularly
- Validate relationship integrity periodically

### 4. Extension
This schema can be extended to support:
- ~~Generics and parameterized types~~ ✅ Supported
- ~~Annotations with parameters~~ ✅ Supported
- Documentation (KDoc)
- Code metrics (cyclomatic complexity, etc.)
- Module dependency relationships
- Versions and Git history

### 5. Indexer Integration
The schema is populated by the CodeGraph indexer which:
- Parses Kotlin source files using tree-sitter
- Extracts all symbols with full metadata
- Resolves cross-file references (function calls, type usage)
- Writes to Neo4j in batch for performance

See `docs/PLAN-INDEXER.md` for implementation details.

---

## Resources

- [Neo4j Documentation](https://neo4j.com/docs/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [Kotlin Language Specification](https://kotlinlang.org/spec/)
