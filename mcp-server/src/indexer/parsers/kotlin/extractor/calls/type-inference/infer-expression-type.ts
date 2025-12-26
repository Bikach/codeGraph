/**
 * Infer type from an expression node.
 */
import type { SyntaxNode } from 'tree-sitter';

/**
 * Infer the Kotlin type from an expression AST node.
 * Returns the inferred type or 'Unknown' if it cannot be determined.
 */
export function inferExpressionType(expression: SyntaxNode): string {
  switch (expression.type) {
    // Literal types - these are certain
    case 'integer_literal':
      return 'Int';
    case 'long_literal':
      return 'Long';
    case 'real_literal':
      // Check for 'f' suffix for Float
      return expression.text.toLowerCase().endsWith('f') ? 'Float' : 'Double';
    case 'string_literal':
      return 'String';
    case 'character_literal':
      return 'Char';
    case 'boolean_literal':
      return 'Boolean';
    case 'null_literal':
      return 'Nothing?';
    case 'lambda_literal':
      return 'Function';

    // Collection literals
    case 'collection_literal':
      // Could be listOf, arrayOf, etc. - hard to determine element type
      return 'Collection';

    // For other expressions, we can't reliably infer the type without full type analysis
    default:
      return 'Unknown';
  }
}
