/**
 * TypeScript Symbol Extractor
 *
 * Main entry point for extracting TypeScript/JavaScript symbols from a tree-sitter AST.
 */

export { extractSymbols } from './extract-symbols.js';
export {
  extractNamespace,
  isNamespaceNode,
  unwrapNamespaceFromExpression,
} from './namespace/index.js';
export type { NamespaceBodyResult } from './namespace/index.js';
export {
  extractAmbientModule,
  isAmbientModuleNode,
} from './ambient/index.js';
export type { AmbientModuleBodyResult } from './ambient/index.js';
