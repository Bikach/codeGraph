/**
 * TypeScript/JavaScript Parser using tree-sitter
 *
 * Initializes and provides the tree-sitter-typescript parser for AST generation.
 * Supports both TypeScript (.ts, .tsx) and JavaScript (.js, .jsx, .mjs, .cjs).
 */

import Parser, { type Language } from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

// Singleton parser instances
let tsParser: Parser | null = null;
let tsxParser: Parser | null = null;

/**
 * Get or create the TypeScript parser instance.
 * The parser is lazily initialized and reused across calls.
 */
export function getTypeScriptParser(): Parser {
  if (!tsParser) {
    tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript as unknown as Language);
  }
  return tsParser;
}

/**
 * Get or create the TSX parser instance.
 * Used for .tsx and .jsx files that may contain JSX syntax.
 */
export function getTSXParser(): Parser {
  if (!tsxParser) {
    tsxParser = new Parser();
    tsxParser.setLanguage(TypeScript.tsx as unknown as Language);
  }
  return tsxParser;
}

/**
 * Parse TypeScript/JavaScript source code into an AST.
 *
 * @param source - The source code to parse
 * @param filePath - Path to the file (used to determine if TSX parser is needed)
 * @returns The root node of the AST
 */
export function parseTypeScript(source: string, filePath: string): Parser.Tree {
  const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  const parser = isTsx ? getTSXParser() : getTypeScriptParser();
  return parser.parse(source);
}

/**
 * Re-export tree-sitter types for convenience
 */
export type { SyntaxNode, Tree } from 'tree-sitter';
