/**
 * Extract all imports from a TypeScript/JavaScript source file.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { extractEsImport } from './extract-es-import.js';
import { extractDynamicImports } from './extract-dynamic-import.js';
import { extractCommonJsRequires } from './extract-commonjs-require.js';

export interface ExtractImportsOptions {
  /** Include CommonJS require() calls (default: true) */
  includeCommonJs?: boolean;
}

/**
 * Extract all imports from a TypeScript/JavaScript AST.
 *
 * This extracts:
 * - ES6 import statements (import x from 'y')
 * - Dynamic import() expressions (await import('./module'))
 * - CommonJS require() calls (const x = require('y')) - enabled by default
 */
export function extractImports(root: SyntaxNode, options: ExtractImportsOptions = {}): ParsedImport[] {
  const { includeCommonJs = true } = options;
  const imports: ParsedImport[] = [];

  // Extract ES6 import statements (top-level only)
  for (const child of root.children) {
    if (child.type === 'import_statement') {
      const extracted = extractEsImport(child);
      imports.push(...extracted);
    }
  }

  // Extract dynamic import() expressions (can be anywhere in the code)
  const dynamicImports = extractDynamicImports(root);
  imports.push(...dynamicImports);

  // Extract CommonJS require() calls (can be anywhere in the code)
  if (includeCommonJs) {
    const commonJsImports = extractCommonJsRequires(root);
    imports.push(...commonJsImports);
  }

  return imports;
}
