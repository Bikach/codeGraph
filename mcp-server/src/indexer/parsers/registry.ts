/**
 * Parser Registry
 *
 * Central registry that maps file extensions to their corresponding
 * language parsers. Parsers are loaded dynamically when needed.
 */

import type { LanguageParser } from '../types.js';

// =============================================================================
// Registry Types
// =============================================================================

type ParserFactory = () => Promise<LanguageParser>;

interface RegisteredParser {
  language: string;
  extensions: string[];
  factory: ParserFactory;
}

// =============================================================================
// Registry State
// =============================================================================

const registeredParsers: RegisteredParser[] = [];
const parserCache = new Map<string, LanguageParser>();

// =============================================================================
// Registration API
// =============================================================================

/**
 * Register a parser factory for a language.
 * The factory is called lazily when the parser is first needed.
 */
export function registerParser(
  language: string,
  extensions: string[],
  factory: ParserFactory
): void {
  // Remove existing registration for this language if any
  const existingIndex = registeredParsers.findIndex((p) => p.language === language);
  if (existingIndex >= 0) {
    registeredParsers.splice(existingIndex, 1);
  }

  registeredParsers.push({ language, extensions, factory });
}

// =============================================================================
// Lookup API
// =============================================================================

/**
 * Get the appropriate parser for a file based on its extension.
 * Returns undefined if no parser is registered for this file type.
 */
export async function getParserForFile(filePath: string): Promise<LanguageParser | undefined> {
  const ext = getExtension(filePath);
  if (!ext) return undefined;

  const registration = registeredParsers.find((p) => p.extensions.includes(ext));
  if (!registration) return undefined;

  // Check cache first
  const cached = parserCache.get(registration.language);
  if (cached) return cached;

  // Load parser via factory
  const parser = await registration.factory();
  parserCache.set(registration.language, parser);
  return parser;
}

/**
 * Get parser by language name.
 */
export async function getParserByLanguage(language: string): Promise<LanguageParser | undefined> {
  const registration = registeredParsers.find((p) => p.language === language);
  if (!registration) return undefined;

  const cached = parserCache.get(language);
  if (cached) return cached;

  const parser = await registration.factory();
  parserCache.set(language, parser);
  return parser;
}

/**
 * Get list of all supported extensions.
 */
export function getSupportedExtensions(): string[] {
  return registeredParsers.flatMap((p) => p.extensions);
}

/**
 * Get list of all registered languages.
 */
export function getRegisteredLanguages(): string[] {
  return registeredParsers.map((p) => p.language);
}

/**
 * Check if a file is supported by any registered parser.
 */
export function isFileSupported(filePath: string): boolean {
  const ext = getExtension(filePath);
  if (!ext) return false;
  return registeredParsers.some((p) => p.extensions.includes(ext));
}

// =============================================================================
// Helpers
// =============================================================================

function getExtension(filePath: string): string | undefined {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot < 0) return undefined;
  return filePath.slice(lastDot).toLowerCase();
}

// =============================================================================
// Built-in Parser Registrations
// =============================================================================

// Kotlin parser registration
registerParser('kotlin', ['.kt', '.kts'], async () => {
  const { kotlinParser } = await import('./kotlin/index.js');
  return kotlinParser;
});

// Java parser registration
registerParser('java', ['.java'], async () => {
  const { javaParser } = await import('./java/index.js');
  return javaParser;
});

// TypeScript parser registration
registerParser('typescript', ['.ts', '.tsx'], async () => {
  const { typescriptParser } = await import('./typescript/index.js');
  return typescriptParser;
});

// JavaScript parser registration
registerParser('javascript', ['.js', '.jsx', '.mjs', '.cjs'], async () => {
  const { javascriptParser } = await import('./typescript/index.js');
  return javascriptParser;
});
