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

// Resolver
export {
  buildSymbolTable,
  resolveSymbols,
  lookupSymbol,
  findSymbols,
  getResolutionStats,
  type Symbol,
  type FunctionSymbol,
  type SymbolTable,
  type ResolutionContext,
  type ResolutionStats,
} from './resolver/index.js';

// Writer
export {
  Neo4jWriter,
  buildFqn,
  serializeTypeParameters,
  type WriteResult,
  type WriteError,
  type WriterOptions,
  type ClearResult,
} from './writer/index.js';

// Domain
export {
  analyzeDomains,
  type Domain,
  type DomainConfig,
  type DomainsConfigFile,
  type DomainAnalysisResult,
  type DomainDependency,
  type DomainInferenceOptions,
} from './domain/index.js';

// File Filtering
export {
  shouldParseFile,
  shouldScanDirectory,
  isTestFile,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_CONFIG_FILES,
  type FileFilterOptions,
} from './file-filter/index.js';

// Module Path Inference (for TypeScript/JavaScript projects)
export {
  inferModulePath,
  collectModulePaths,
  buildModuleHierarchy,
  getParentModulePath,
  getModuleName,
  type ModuleInferenceOptions,
} from './module/index.js';
