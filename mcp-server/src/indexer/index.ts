/**
 * Indexer Module
 *
 * Main entry point for the code indexer. Re-exports all public APIs.
 */

// Types
export type {
  SourceLocation,
  Visibility,
  ParsedImport,
  ParsedAnnotation,
  ParsedParameter,
  ParsedProperty,
  ParsedFunction,
  ParsedCall,
  ParsedClass,
  ParsedFile,
  LanguageParser,
  ResolvedCall,
  ResolvedFile,
  // Advanced types for language-specific features
  ParsedTypeParameter,
  ParsedConstructor,
  ParsedTypeAlias,
  ParsedDestructuringDeclaration,
  ParsedObjectExpression,
  ParsedFunctionType,
} from './types.js';

// Parser Registry
export {
  registerParser,
  getParserForFile,
  getParserByLanguage,
  getSupportedExtensions,
  getRegisteredLanguages,
  isFileSupported,
} from './parsers/registry.js';

// Resolver (TODO: Étape 3)
// export { resolveSymbols } from './resolver.js';

// Writer (TODO: Étape 4)
// export { writeToNeo4j } from './writer.js';
