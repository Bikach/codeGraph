/**
 * Java Parser Module
 *
 * Exports the Java language parser implementing the LanguageParser interface.
 * Uses tree-sitter-java for AST generation and a custom extractor for
 * symbol extraction.
 */

import type { LanguageParser, ParsedFile } from '../../types.js';
import { parseJava } from './parser.js';
import { extractSymbols } from './extractor/index.js';

/**
 * Java language parser.
 *
 * Parses Java source files (.java) and extracts:
 * - Package declarations
 * - Import statements (including static imports)
 * - Classes, interfaces, enums, records, annotation types
 * - Methods
 * - Fields
 * - Constructors
 * - Method calls
 */
export const javaParser: LanguageParser = {
  language: 'java',
  extensions: ['.java'],

  async parse(source: string, filePath: string): Promise<ParsedFile> {
    // Parse source into AST
    const tree = parseJava(source);

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
