/**
 * Kotlin Parser Module
 *
 * Exports the Kotlin language parser implementing the LanguageParser interface.
 * Uses tree-sitter-kotlin for AST generation and a custom extractor for
 * symbol extraction.
 */

import type { LanguageParser, ParsedFile } from '../../types.js';
import { parseKotlin } from './parser.js';
import { extractSymbols } from './extractor/index.js';

/**
 * Kotlin language parser.
 *
 * Parses Kotlin source files (.kt, .kts) and extracts:
 * - Package declarations
 * - Import statements
 * - Classes, interfaces, objects, enums, annotations
 * - Functions (including extension functions, suspend functions)
 * - Properties (val/var)
 * - Function calls (unresolved)
 */
export const kotlinParser: LanguageParser = {
  language: 'kotlin',
  extensions: ['.kt', '.kts'],

  async parse(source: string, filePath: string): Promise<ParsedFile> {
    // Parse source into AST
    const tree = parseKotlin(source);

    // Extract symbols from AST
    const parsed = extractSymbols(tree, filePath);

    // Set filePath in all locations
    setFilePathInLocations(parsed, filePath);

    return parsed;
  },
};

/**
 * Recursively set filePath in all SourceLocation objects.
 */
function setFilePathInLocations(parsed: ParsedFile, filePath: string): void {
  for (const cls of parsed.classes) {
    setFilePathInClass(cls, filePath);
  }

  for (const fn of parsed.topLevelFunctions) {
    setFilePathInFunction(fn, filePath);
  }

  for (const prop of parsed.topLevelProperties) {
    prop.location.filePath = filePath;
  }
}

function setFilePathInClass(cls: ParsedFile['classes'][0], filePath: string): void {
  cls.location.filePath = filePath;

  for (const fn of cls.functions) {
    setFilePathInFunction(fn, filePath);
  }

  for (const prop of cls.properties) {
    prop.location.filePath = filePath;
  }

  for (const nested of cls.nestedClasses) {
    setFilePathInClass(nested, filePath);
  }
}

function setFilePathInFunction(fn: ParsedFile['topLevelFunctions'][0], filePath: string): void {
  fn.location.filePath = filePath;
  for (const call of fn.calls) {
    call.location.filePath = filePath;
  }
}
