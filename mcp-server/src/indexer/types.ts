/**
 * Common types for the multi-language code indexer.
 *
 * These types are shared across all language parsers and represent
 * the normalized output format that feeds into the resolver and writer.
 */

// =============================================================================
// Source Location
// =============================================================================

export interface SourceLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// =============================================================================
// Parsed Elements (output of language-specific extractors)
// =============================================================================

export type Visibility = 'public' | 'private' | 'protected' | 'internal';

export interface ParsedImport {
  /** Full import path (e.g., "com.example.User") */
  path: string;
  /** Alias if renamed (e.g., "import User as AppUser") */
  alias?: string;
  /** Is it a wildcard import? (e.g., "import com.example.*") */
  isWildcard: boolean;
}

export interface ParsedAnnotation {
  name: string;
  arguments?: Record<string, string>;
}

export interface ParsedParameter {
  name: string;
  type?: string;
  defaultValue?: string;
  annotations: ParsedAnnotation[];
}

export interface ParsedProperty {
  name: string;
  type?: string;
  visibility: Visibility;
  isVal: boolean; // true = val (immutable), false = var (mutable)
  initializer?: string;
  annotations: ParsedAnnotation[];
  location: SourceLocation;
}

export interface ParsedFunction {
  name: string;
  visibility: Visibility;
  parameters: ParsedParameter[];
  returnType?: string;
  isAbstract: boolean;
  isSuspend: boolean;
  isExtension: boolean;
  receiverType?: string; // For extension functions: "String.capitalize()"
  annotations: ParsedAnnotation[];
  location: SourceLocation;
  /** Raw function calls found in the body (unresolved) */
  calls: ParsedCall[];
}

export interface ParsedCall {
  /** Function name being called */
  name: string;
  /** Receiver expression if any (e.g., "user" in "user.save()") */
  receiver?: string;
  /** Receiver type if known */
  receiverType?: string;
  location: SourceLocation;
}

export interface ParsedClass {
  name: string;
  kind: 'class' | 'interface' | 'object' | 'enum' | 'annotation';
  visibility: Visibility;
  isAbstract: boolean;
  isData: boolean;
  isSealed: boolean;
  superClass?: string;
  interfaces: string[];
  annotations: ParsedAnnotation[];
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
  location: SourceLocation;
}

export interface ParsedFile {
  filePath: string;
  packageName?: string;
  imports: ParsedImport[];
  classes: ParsedClass[];
  /** Top-level functions (Kotlin-specific but other languages may have them) */
  topLevelFunctions: ParsedFunction[];
  /** Top-level properties */
  topLevelProperties: ParsedProperty[];
}

// =============================================================================
// Language Parser Interface
// =============================================================================

export interface LanguageParser {
  /** Unique identifier for the language (e.g., "kotlin", "java") */
  readonly language: string;

  /** File extensions this parser handles (e.g., [".kt", ".kts"]) */
  readonly extensions: string[];

  /**
   * Parse a source file and extract all symbols.
   * @param source - The source code content
   * @param filePath - Path to the file (for location info)
   * @returns Parsed file with all extracted symbols
   */
  parse(source: string, filePath: string): Promise<ParsedFile>;
}

// =============================================================================
// Resolved Elements (output of resolver, input to writer)
// =============================================================================

export interface ResolvedCall {
  /** Fully qualified name of the caller (e.g., "com.example.UserService.save") */
  fromFqn: string;
  /** Fully qualified name of the callee (e.g., "com.example.UserRepository.save") */
  toFqn: string;
  location: SourceLocation;
}

export interface ResolvedFile extends ParsedFile {
  /** Resolved calls with fully qualified names */
  resolvedCalls: ResolvedCall[];
}
