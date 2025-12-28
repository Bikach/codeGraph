/**
 * Extract source location from AST node.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { SourceLocation } from '../../../../types.js';

/**
 * Extract the source location from a syntax node.
 * Line and column numbers are 1-based.
 */
export function nodeLocation(node: SyntaxNode): SourceLocation {
  return {
    filePath: '', // Will be set by caller
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column + 1,
  };
}
