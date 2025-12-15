# Kotlin Parser - Remaining Test Coverage

## Current Status
- **Tests**: 45 (from 26 initially)
- **Coverage**: ~85%
- **Bugs fixed**: 7

---

## Priority 3 - Low Priority Tests (Supported but untested)

These features ARE implemented in the extractor but have no dedicated tests:

| Feature | Example | Notes |
|---------|---------|-------|
| Delegated properties | `val name by lazy { "default" }` | `property_delegate` captured in extractor |
| Property initializers | `val x = computeValue()` | Already extracted but not tested |
| Function visibility | `private fun helper()` | Same as class visibility |
| Nested interfaces | `class Outer { interface Inner }` | Should work with nested classes |
| Multiple nested levels | `class A { class B { class C } }` | Deep nesting |

---

## Priority 4 - Extracteur Enhancements (NOT supported)

These Kotlin features are NOT currently supported by the extractor and would require implementation:

### High Value
| Feature | Example | Complexity |
|---------|---------|------------|
| **Companion objects** | `companion object Factory { }` | Medium - new node type |
| **Primary constructor properties** | `class User(val id: String)` | Medium - params as properties |
| **Generics / Type parameters** | `class Repo<T : Entity>` | High - type parameter extraction |
| **Generic functions** | `fun <T> List<T>.first(): T?` | High - function type params |

### Medium Value
| Feature | Example | Complexity |
|---------|---------|------------|
| Secondary constructors | `constructor(id: String) : this()` | Medium |
| Inline functions | `inline fun <T> run(block: () -> T)` | Low - just a modifier |
| Infix functions | `infix fun Int.add(x: Int)` | Low - just a modifier |
| Operator functions | `operator fun plus(other: X)` | Low - just a modifier |
| Lambda parameters | `fun process(cb: (Int) -> String)` | High - function types |
| Default parameter values | `fun greet(name: String = "World")` | Medium - AST structure issue |

### Low Value
| Feature | Example | Complexity |
|---------|---------|------------|
| Annotation arguments | `@Deprecated("msg", level=WARNING)` | Medium |
| Type aliases | `typealias UserList = List<User>` | Low |
| Destructuring | `val (a, b) = pair` | Medium |
| Object expressions | `object : Interface { }` | Medium |

---

## How to Continue

1. **Priority 3**: Add simple tests for existing functionality (quick wins)
2. **Priority 4**: Implement companion objects first (most commonly used)
3. Then generics (essential for type analysis)
4. Then primary constructor properties (very common pattern)

---

## Commands

```bash
# Run tests
cd mcp-server && npm test

# Run specific test file
npm test -- --run src/indexer/parsers/kotlin/index.test.ts

# Debug AST for new feature
npx tsx -e "
import Parser from 'tree-sitter';
import Kotlin from 'tree-sitter-kotlin';
const parser = new Parser();
parser.setLanguage(Kotlin);
const tree = parser.parse('YOUR_KOTLIN_CODE');
// print tree...
"
```
