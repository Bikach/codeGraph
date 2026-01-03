/**
 * Java Parser using tree-sitter
 *
 * Initializes and provides the tree-sitter-java parser for AST generation.
 */

import Parser, { type Language } from 'tree-sitter';
import Java from 'tree-sitter-java';

// Singleton parser instance
let parserInstance: Parser | null = null;

/**
 * Get or create the tree-sitter parser instance.
 * The parser is lazily initialized and reused across calls.
 */
export function getParser(): Parser {
  if (!parserInstance) {
    parserInstance = new Parser();
    parserInstance.setLanguage(Java as unknown as Language);
  }
  return parserInstance;
}

/**
 * Parse Java source code into an AST.
 *
 * @param source - The Java source code to parse
 * @returns The root node of the AST
 */
export function parseJava(source: string): Parser.Tree {
  const parser = getParser();
  return parser.parse(source);
}

/**
 * Re-export tree-sitter types for convenience
 */
export type { SyntaxNode, Tree } from 'tree-sitter';
