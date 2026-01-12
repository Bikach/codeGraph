/**
 * Common types for the multi-language code indexer.
 *
 * These types are shared across all language parsers and represent
 * the normalized output format that feeds into the resolver and writer.
 */

// =============================================================================
// Supported Languages
// =============================================================================

/**
 * Supported programming languages for parsing and resolution.
 * Each language may have its own stdlib provider for symbol resolution.
 */
export type SupportedLanguage = 'kotlin' | 'java' | 'typescript' | 'javascript';

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
  /** Full import path (e.g., "com.example.User" or "./module") */
  path: string;
  /** Imported symbol name (e.g., "User" in "import { User } from ...") */
  name?: string;
  /** Alias if renamed (e.g., "import User as AppUser" or "import { X as Y }") */
  alias?: string;
  /** Is it a wildcard import? (e.g., "import com.example.*" or "import * as X") */
  isWildcard?: boolean;
  /** Is this a type-only import? (TypeScript: "import type { X }") */
  isTypeOnly?: boolean;
  /** Is this a dynamic import? (e.g., "import('./module')") */
  isDynamic?: boolean;
  /** Is the path a template literal? (e.g., "import(`./module/${name}`)") */
  isTemplateLiteral?: boolean;
}

/**
 * Represents an re-export statement in TypeScript/JavaScript.
 * Re-exports make symbols from other modules available from the current module.
 *
 * Examples:
 * - export { foo as bar } from './module';
 * - export * as utils from './utils';
 * - export { default as Component } from './Component';
 * - export * from './module';
 * - export type { User as AppUser } from './types';
 */
export interface ParsedReexport {
  /** Source module path (e.g., "./module" or "@package/name") */
  sourcePath: string;
  /** Original name being exported (undefined for wildcard: export *) */
  originalName?: string;
  /** Alias/exported name (e.g., "bar" in "export { foo as bar }") */
  exportedName?: string;
  /** Is it a namespace re-export? (export * as X from 'y') */
  isNamespaceReexport?: boolean;
  /** Is it a wildcard re-export without alias? (export * from 'y') */
  isWildcard?: boolean;
  /** Is this a type-only re-export? (TypeScript: "export type { X }") */
  isTypeOnly?: boolean;
}

export interface ParsedAnnotation {
  name: string;
  arguments?: Record<string, string>;
}

export interface ParsedTypeParameter {
  name: string;
  bounds?: string[]; // Upper bounds: T : Comparable<T> (includes where clause bounds)
  variance?: 'in' | 'out'; // Kotlin variance annotations
  isReified?: boolean; // Kotlin reified type parameter
}

/**
 * Represents a function type parameter like `(Int, String) -> Boolean`
 * Used for lambda/higher-order function parameters.
 */
export interface ParsedFunctionType {
  parameterTypes: string[];
  returnType: string;
  isSuspend: boolean;
  /** Receiver type for extension function types: `Int.(String) -> Boolean` */
  receiverType?: string;
}

export interface ParsedParameter {
  name: string;
  type?: string;
  /** For lambda parameters, the parsed function type */
  functionType?: ParsedFunctionType;
  defaultValue?: string;
  annotations: ParsedAnnotation[];
  /** Kotlin crossinline modifier for inline function lambda parameters */
  isCrossinline?: boolean;
  /** Kotlin noinline modifier for inline function lambda parameters */
  isNoinline?: boolean;
}

/**
 * TypeScript type guard information for functions.
 *
 * Type guards are functions that narrow types at runtime:
 * - Type predicate: `function isString(x): x is string`
 * - Assertion function: `function assertDefined(x): asserts x is T`
 * - This type guard: `function isValid(): this is ValidType`
 */
export interface ParsedTypeGuard {
  /** The parameter being guarded (e.g., "x" in "x is string", or "this") */
  parameter: string;
  /** The narrowed type (e.g., "string" in "x is string") */
  narrowedType: string;
  /** Whether this is an assertion function (uses `asserts` keyword) */
  isAssertion: boolean;
}

export interface ParsedConstructor {
  parameters: ParsedParameter[];
  visibility: Visibility;
  delegatesTo?: 'this' | 'super';
  annotations: ParsedAnnotation[];
  location: SourceLocation;
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

/**
 * Represents a function overload signature (TypeScript).
 * Overload signatures declare the callable signatures of a function
 * without providing an implementation body.
 */
export interface ParsedOverloadSignature {
  /** Parameters for this specific overload signature */
  parameters: ParsedParameter[];
  /** Return type for this specific overload signature */
  returnType?: string;
  /** Type parameters (generics) for this specific overload signature */
  typeParameters?: ParsedTypeParameter[];
  /** Location of this overload signature in source */
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
  isInline?: boolean;
  isInfix?: boolean;
  isOperator?: boolean;
  typeParameters?: ParsedTypeParameter[];
  annotations: ParsedAnnotation[];
  location: SourceLocation;
  /** Raw function calls found in the body (unresolved) */
  calls: ParsedCall[];
  /**
   * Overload signatures for this function (TypeScript-specific).
   * When present, this function has multiple call signatures.
   * The main parameters/returnType represent the implementation signature,
   * while overloads contain the declared callable signatures.
   */
  overloads?: ParsedOverloadSignature[];
  /**
   * Indicates this is an overload signature without implementation.
   * Used for interface method signatures and ambient declarations.
   */
  isOverloadSignature?: boolean;
  /** TypeScript type guard info if this is a type guard function */
  typeGuard?: ParsedTypeGuard;
}

export interface ParsedCall {
  /** Function name being called */
  name: string;
  /** Receiver expression if any (e.g., "user" in "user.save()") */
  receiver?: string;
  /** Receiver type if known */
  receiverType?: string;
  /** Argument types for overload resolution (if inferrable) */
  argumentTypes?: string[];
  /** Number of arguments (always known even if types aren't) */
  argumentCount?: number;
  /** Is this a safe call (receiver?.method())? */
  isSafeCall?: boolean;
  /** Is this a constructor call? (resolved at resolution time) */
  isConstructorCall?: boolean;
  location: SourceLocation;
}

export interface ParsedClass {
  name: string;
  kind: 'class' | 'interface' | 'object' | 'enum' | 'annotation';
  visibility: Visibility;
  isAbstract: boolean;
  isData: boolean;
  isSealed: boolean;
  /** Permitted subclasses for sealed classes (Java 17+) */
  permittedSubclasses?: string[];
  superClass?: string;
  interfaces: string[];
  typeParameters?: ParsedTypeParameter[];
  annotations: ParsedAnnotation[];
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
  companionObject?: ParsedClass;
  secondaryConstructors?: ParsedConstructor[];
  location: SourceLocation;
}

/**
 * Represents a TypeScript mapped type modifier.
 * Examples: readonly, +readonly, -readonly, ?, +?, -?
 */
export interface ParsedMappedTypeModifier {
  /** The modifier keyword (readonly or optional represented as '?') */
  kind: 'readonly' | 'optional';
  /** The modifier prefix: '+' (add), '-' (remove), or undefined (no change) */
  prefix?: '+' | '-';
}

/**
 * Represents a TypeScript mapped type.
 * Examples:
 * - { [K in keyof T]: T[K] }
 * - { readonly [K in keyof T]: T[K] }
 * - { [K in keyof T]?: T[K] }
 * - { [K in keyof T as NewKey]: T[K] }
 */
export interface ParsedMappedType {
  /** The key type parameter name (e.g., 'K' in [K in keyof T]) */
  keyName: string;
  /** The constraint expression (e.g., 'keyof T' in [K in keyof T]) */
  constraint: string;
  /** Whether constraint uses keyof operator */
  hasKeyof: boolean;
  /** The value type expression (e.g., 'T[K]') */
  valueType: string;
  /** Key remapping clause if present (e.g., 'NewKey' in [K in keyof T as NewKey]) */
  asClause?: string;
  /** Applied modifiers (readonly, optional with +/-) */
  modifiers: ParsedMappedTypeModifier[];
}

/**
 * Represents a parsed conditional type: `T extends U ? X : Y`
 *
 * Conditional types are a powerful TypeScript feature that allows types to be
 * selected based on a type relationship test.
 */
export interface ParsedConditionalType {
  /** The type being checked (e.g., "T" in "T extends any[]") */
  checkType: string;
  /** The type in the extends clause (e.g., "any[]" in "T extends any[]") */
  extendsType: string;
  /** The type returned when the condition is true */
  trueType: string;
  /** The type returned when the condition is false */
  falseType: string;
  /** Inferred type declarations within this conditional (e.g., "U" in "infer U") */
  inferTypes?: string[];
  /** Nested conditional type in the true branch */
  nestedTrueConditional?: ParsedConditionalType;
  /** Nested conditional type in the false branch */
  nestedFalseConditional?: ParsedConditionalType;
}

export interface ParsedTypeAlias {
  name: string;
  aliasedType: string;
  visibility: Visibility;
  typeParameters?: ParsedTypeParameter[];
  /** Structured mapped type if the alias is a mapped type */
  mappedType?: ParsedMappedType;
  /** Structured conditional type if the aliased type is a conditional */
  conditionalType?: ParsedConditionalType;
  location: SourceLocation;
}

/**
 * Destructuring declaration: `val (a, b) = pair`
 * Each component is a separate property extraction.
 */
export interface ParsedDestructuringDeclaration {
  /** Names of the destructured components (e.g., ["a", "b"]) */
  componentNames: string[];
  /** Types of components if explicitly declared */
  componentTypes?: (string | undefined)[];
  /** The source expression being destructured */
  initializer?: string;
  visibility: Visibility;
  isVal: boolean;
  location: SourceLocation;
}

/**
 * Object expression (anonymous object): `object : Interface { ... }`
 */
export interface ParsedObjectExpression {
  /** Interfaces/classes this object implements/extends */
  superTypes: string[];
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  location: SourceLocation;
}

export interface ParsedFile {
  filePath: string;
  /** Language of the source file (determines which stdlib to use for resolution) */
  language: SupportedLanguage;
  packageName?: string;
  imports: ParsedImport[];
  /** Re-exports (export { ... } from 'module' or export * from 'module') */
  reexports: ParsedReexport[];
  classes: ParsedClass[];
  /** Top-level functions (Kotlin-specific but other languages may have them) */
  topLevelFunctions: ParsedFunction[];
  /** Top-level properties */
  topLevelProperties: ParsedProperty[];
  /** Top-level type aliases (Kotlin-specific) */
  typeAliases: ParsedTypeAlias[];
  /** Destructuring declarations at top level */
  destructuringDeclarations: ParsedDestructuringDeclaration[];
  /** Object expressions used in assignments/returns (for dependency tracking) */
  objectExpressions: ParsedObjectExpression[];
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
