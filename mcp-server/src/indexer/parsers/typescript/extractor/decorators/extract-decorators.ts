/**
 * Extract decorators from a TypeScript declaration node.
 *
 * TypeScript AST structure for decorators:
 * - Decorators appear as 'decorator' nodes before the declaration
 * - Each decorator has a call_expression or identifier child
 *
 * Examples:
 * - @Injectable
 * - @Injectable()
 * - @Component({ selector: 'app' })
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedAnnotation } from '../../../../types.js';
import { findChildByType, findChildrenByType } from '../ast-utils/index.js';

/**
 * Extract all decorators from a TypeScript declaration node.
 * Decorators are returned as ParsedAnnotation for compatibility with other parsers.
 */
export function extractDecorators(node: SyntaxNode): ParsedAnnotation[] {
  const decorators: ParsedAnnotation[] = [];

  // Find all decorator children
  const decoratorNodes = findChildrenByType(node, 'decorator');

  for (const decoratorNode of decoratorNodes) {
    const annotation = extractSingleDecorator(decoratorNode);
    if (annotation) {
      decorators.push(annotation);
    }
  }

  return decorators;
}

/**
 * Extract a single decorator from a decorator AST node.
 *
 * Decorator structure:
 * - decorator > @ call_expression (for @Foo() or @Foo(args))
 * - decorator > @ identifier (for @Foo without parentheses)
 */
function extractSingleDecorator(decoratorNode: SyntaxNode): ParsedAnnotation | undefined {
  // Skip the @ symbol
  const expr =
    findChildByType(decoratorNode, 'call_expression') ??
    findChildByType(decoratorNode, 'identifier') ??
    findChildByType(decoratorNode, 'member_expression');

  if (!expr) return undefined;

  if (expr.type === 'call_expression') {
    // @Decorator() or @Decorator(args)
    const functionNode = findChildByType(expr, 'identifier') ?? findChildByType(expr, 'member_expression');
    const name = functionNode?.text ?? expr.text;
    const args = extractDecoratorArguments(expr);

    return {
      name: extractDecoratorName(name),
      arguments: Object.keys(args).length > 0 ? args : undefined,
    };
  }

  // @Decorator without parentheses
  return {
    name: extractDecoratorName(expr.text),
  };
}

/**
 * Extract decorator arguments from a call_expression.
 *
 * Handles:
 * - @Decorator({ key: 'value' })
 * - @Decorator('value')
 * - @Decorator(SomeConstant)
 */
function extractDecoratorArguments(callExpr: SyntaxNode): Record<string, string> {
  const args: Record<string, string> = {};

  const argsNode = findChildByType(callExpr, 'arguments');
  if (!argsNode) return args;

  let argIndex = 0;
  for (const child of argsNode.children) {
    // Skip punctuation
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;

    if (child.type === 'object') {
      // Object literal argument: { key: value, ... }
      for (const pair of child.children) {
        if (pair.type === 'pair') {
          const keyNode = pair.children[0];
          const valueNode = pair.children.find(
            (n) => n.type !== ':' && n !== keyNode && n.type !== 'property_identifier'
          );
          if (keyNode && valueNode) {
            const key = keyNode.text.replace(/['"`]/g, '');
            args[key] = valueNode.text;
          }
        }
      }
    } else {
      // Positional argument
      args[`arg${argIndex}`] = child.text;
      argIndex++;
    }
  }

  return args;
}

/**
 * Extract the simple decorator name from a potentially qualified name.
 * For "decorators.Injectable", returns "Injectable".
 */
function extractDecoratorName(fullName: string): string {
  const parts = fullName.split('.');
  return parts[parts.length - 1] ?? fullName;
}
