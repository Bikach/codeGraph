/**
 * TypeScript/JavaScript Parser Module
 *
 * Exports the TypeScript and JavaScript language parsers implementing the
 * LanguageParser interface. Uses tree-sitter-typescript for AST generation
 * and a custom extractor for symbol extraction.
 *
 * TypeScript is a superset of JavaScript, so both languages use the same
 * parser infrastructure. The JavaScript parser simply marks the output
 * with 'javascript' as the language.
 */

import type { LanguageParser, ParsedFile } from '../../types.js';
import { parseTypeScript } from './parser.js';
import { extractSymbols } from './extractor/index.js';

/**
 * TypeScript language parser.
 *
 * Parses TypeScript source files (.ts, .tsx) and extracts:
 * - Import statements
 * - Classes, interfaces, enums, type aliases
 * - Functions (including arrow functions, async functions)
 * - Variables and constants
 * - Function calls (unresolved)
 */
export const typescriptParser: LanguageParser = {
  language: 'typescript',
  extensions: ['.ts', '.tsx'],

  async parse(source: string, filePath: string): Promise<ParsedFile> {
    // Parse source into AST
    const tree = parseTypeScript(source, filePath);

    // Extract symbols from AST
    const parsed = extractSymbols(tree, filePath);

    // Set filePath in all locations
    setFilePathInLocations(parsed, filePath);

    return parsed;
  },
};

/**
 * JavaScript language parser.
 *
 * JavaScript reuses the TypeScript parser since TypeScript is a superset.
 * The only difference is that the output is marked with 'javascript' as
 * the language identifier.
 */
export const javascriptParser: LanguageParser = {
  language: 'javascript',
  extensions: ['.js', '.jsx', '.mjs', '.cjs'],

  async parse(source: string, filePath: string): Promise<ParsedFile> {
    // Parse source into AST (TypeScript parser handles JS files)
    const tree = parseTypeScript(source, filePath);

    // Extract symbols from AST
    const parsed = extractSymbols(tree, filePath);

    // Mark as JavaScript
    parsed.language = 'javascript';

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

  for (const typeAlias of parsed.typeAliases) {
    typeAlias.location.filePath = filePath;
  }

  for (const destructuring of parsed.destructuringDeclarations) {
    destructuring.location.filePath = filePath;
  }

  for (const objectExpr of parsed.objectExpressions) {
    objectExpr.location.filePath = filePath;
    for (const prop of objectExpr.properties) {
      prop.location.filePath = filePath;
    }
    for (const fn of objectExpr.functions) {
      setFilePathInFunction(fn, filePath);
    }
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

  if (cls.companionObject) {
    setFilePathInClass(cls.companionObject, filePath);
  }

  if (cls.secondaryConstructors) {
    for (const ctor of cls.secondaryConstructors) {
      ctor.location.filePath = filePath;
    }
  }
}

function setFilePathInFunction(fn: ParsedFile['topLevelFunctions'][0], filePath: string): void {
  fn.location.filePath = filePath;
  for (const call of fn.calls) {
    call.location.filePath = filePath;
  }
}
