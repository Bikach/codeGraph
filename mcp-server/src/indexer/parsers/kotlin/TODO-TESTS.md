# Kotlin Parser - Remaining Test Coverage

## Current Status
- **Tests**: 61 (from 26 initially)
- **Coverage**: ~95%
- **Bugs fixed**: 7

---

## ~~Priority 3 - Low Priority Tests (Supported but untested)~~ ✅ DONE

All features below are now tested:

| Feature | Status |
|---------|--------|
| Delegated properties (`by lazy`, `by Delegates.observable`, `by map`) | ✅ Tested |
| Property initializers (simple, function calls, object instantiation) | ✅ Tested |
| Function visibility (`private`, `internal`, `protected`, `public`) | ✅ Tested |
| Nested interfaces | ✅ Tested |
| Nested objects | ✅ Tested |
| Multiple nested levels (deep nesting) | ✅ Tested |
| Mixed nested types at same level | ✅ Tested |

---

## Priority 4 - Extractor Enhancements (NOT supported)

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

## Next Steps

1. **Companion objects** - Most commonly used Kotlin feature, implement first
2. **Primary constructor properties** - Very common pattern (`class User(val id: String)`)
3. **Generics** - Essential for complete type analysis

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
