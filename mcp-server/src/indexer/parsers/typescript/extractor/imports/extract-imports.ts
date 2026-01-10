/**
 * Extract all imports from a TypeScript/JavaScript source file.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { extractEsImport } from './extract-es-import.js';

/**
 * Extract all ES6 import declarations from the root of a TypeScript/JavaScript AST.
 * This only handles ES6 imports (import statements).
 * Use extractCommonJsRequires() separately for CommonJS require() calls.
 */
export function extractImports(root: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  for (const child of root.children) {
    if (child.type === 'import_statement') {
      const extracted = extractEsImport(child);
      imports.push(...extracted);
    }
  }

  return imports;
}
