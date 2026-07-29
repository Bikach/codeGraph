/**
 * Type-name extraction & resolution (storage-agnostic).
 *
 * Pure helpers shared by every GraphWriteStore implementation to derive USES/RETURNS edges from
 * type strings. Lives outside the store layer so any backend (e.g. EmbeddedStore) can reuse it
 * without dragging in a specific driver.
 */

import type { ImportResolutionMap } from './resolver/module-resolver/index.js';

/**
 * Built-in types that should not create USES relationships.
 * Includes both Kotlin and TypeScript primitives, utility types, and built-in objects.
 */
const BUILTIN_TYPES = new Set([
  // Kotlin types
  'Unit',
  'Nothing',
  'Any',
  'Boolean',
  'Byte',
  'Short',
  'Int',
  'Long',
  'Float',
  'Double',
  'Char',
  'String',
  'Array',
  'List',
  'Set',
  'Map',
  'Collection',
  'Iterable',
  'Sequence',
  'Pair',
  'Triple',
  'Result',
  'Comparable',
  'Number',
  'Enum',
  'Object',
  'Throwable',
  'Exception',
  'Error',
  'RuntimeException',

  // TypeScript primitive types (PascalCase for type annotations)
  'Void',
  'Never',
  'Unknown',
  'Undefined',
  'Null',
  'BigInt',
  'Symbol',

  // TypeScript utility types
  'Partial',
  'Required',
  'Readonly',
  'Record',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'ConstructorParameters',
  'InstanceType',
  'ThisParameterType',
  'OmitThisParameter',
  'ThisType',
  'Awaited',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
  'NoInfer',

  // TypeScript built-in objects and types
  'Promise',
  'ArrayLike',
  'Iterator',
  'IterableIterator',
  'AsyncIterator',
  'AsyncIterableIterator',
  'Generator',
  'AsyncGenerator',
  'ReadonlyArray',
  'ReadonlyMap',
  'ReadonlySet',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'Function',
  'Date',
  'RegExp',
  'JSON',
  'Math',
  'Proxy',
  'Reflect',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',

  // DOM types (commonly used in TypeScript)
  'HTMLElement',
  'HTMLDivElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'HTMLAnchorElement',
  'HTMLImageElement',
  'HTMLSpanElement',
  'HTMLParagraphElement',
  'Element',
  'Node',
  'NodeList',
  'Document',
  'Window',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'CustomEvent',
  'EventTarget',
  'Response',
  'Request',
  'Headers',
  'URL',
  'URLSearchParams',
  'FormData',
  'Blob',
  'File',
  'FileReader',
  'AbortController',
  'AbortSignal',
]);

/**
 * Extract simple type names from a type string.
 * Handles generics, nullability, and nested types.
 * e.g., "List<User>" -> ["List", "User"], "Map<String, User?>" -> ["Map", "String", "User"]
 */
export function extractTypeNames(typeStr: string | undefined): string[] {
  if (!typeStr) return [];

  const types: string[] = [];
  // Remove nullable markers and extract type names
  const cleaned = typeStr.replace(/\?/g, '');

  // Match type identifiers (capitalized words that are likely type names)
  // This regex matches PascalCase identifiers
  const typePattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;
  let match;
  while ((match = typePattern.exec(cleaned)) !== null) {
    const typeName = match[1]!;
    // Skip common primitive/built-in types that don't need USES relationships
    if (!BUILTIN_TYPES.has(typeName)) {
      types.push(typeName);
    }
  }

  return [...new Set(types)]; // Remove duplicates
}

/**
 * Resolve type names to FQNs using import resolution map.
 * Falls back to simple names if resolution fails.
 *
 * @param typeStr - Type string (e.g., "User | null", "Observable<User>")
 * @param importMap - Import resolution map for the current file
 * @returns Array of resolved types with name and optional FQN
 */
export function resolveTypeNames(
  typeStr: string | undefined,
  importMap?: ImportResolutionMap
): Array<{ name: string; fqn?: string }> {
  const simpleNames = extractTypeNames(typeStr);

  return simpleNames.map((name) => {
    // Try to resolve via imports
    const fqn = importMap?.get(name);
    return { name, fqn };
  });
}
