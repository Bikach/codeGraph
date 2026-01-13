/**
 * Infer type from an expression node in TypeScript AST.
 */
import type { SyntaxNode } from 'tree-sitter';

/**
 * Infer the TypeScript type from an expression AST node.
 * Returns the inferred type or 'unknown' if it cannot be determined.
 *
 * Note: TypeScript uses lowercase for primitive types (string, number, boolean)
 * unlike Kotlin which uses capitalized types (String, Int, Boolean).
 */
export function inferExpressionType(expression: SyntaxNode): string {
  switch (expression.type) {
    // Numeric literals
    case 'number':
      return inferNumberType(expression.text);

    // String literals
    case 'string':
    case 'template_string':
      return 'string';

    // Boolean literals
    case 'true':
    case 'false':
      return 'boolean';

    // Null and undefined
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';

    // Regex
    case 'regex':
      return 'RegExp';

    // Array literal
    case 'array':
      return inferArrayType(expression);

    // Object literal
    case 'object':
      return 'object';

    // Arrow function or function expression
    case 'arrow_function':
    case 'function_expression':
      return 'Function';

    // Class expression
    case 'class_expression':
      return 'Function'; // Classes are functions in JS/TS

    // New expression - returns instance of the class
    case 'new_expression':
      return inferNewExpressionType(expression);

    // Await expression - unwrap the promise type
    case 'await_expression':
      return 'unknown'; // Would need full type system to resolve

    // Parenthesized expression - unwrap
    case 'parenthesized_expression':
      return inferParenthesizedType(expression);

    // Binary expressions
    case 'binary_expression':
      return inferBinaryExpressionType(expression);

    // Unary expressions
    case 'unary_expression':
      return inferUnaryExpressionType(expression);

    // Ternary expression
    case 'ternary_expression':
      return 'unknown'; // Would need type unification

    // Type assertion (as expression)
    case 'as_expression':
    case 'type_assertion':
      return inferTypeAssertionType(expression);

    // Satisfies expression - returns the original type
    case 'satisfies_expression':
      return inferSatisfiesType(expression);

    // Non-null assertion (x!)
    case 'non_null_expression':
      return inferNonNullType(expression);

    // For identifiers, calls, member expressions - need context
    case 'identifier':
    case 'call_expression':
    case 'member_expression':
    case 'subscript_expression':
      return 'unknown';

    // Default: cannot infer
    default:
      return 'unknown';
  }
}

/**
 * Infer type from a number literal.
 * Checks for BigInt suffix 'n'.
 */
function inferNumberType(text: string): string {
  if (text.endsWith('n')) {
    return 'bigint';
  }
  return 'number';
}

/**
 * Infer type from an array literal.
 * Returns 'Array<T>' if all elements have the same type, otherwise 'Array<unknown>'.
 */
function inferArrayType(node: SyntaxNode): string {
  const elements: string[] = [];

  for (const child of node.children) {
    // Skip brackets and commas
    if (child.type === '[' || child.type === ']' || child.type === ',') continue;

    // Handle spread elements
    if (child.type === 'spread_element') {
      return 'Array<unknown>';
    }

    const elementType = inferExpressionType(child);
    if (elementType !== 'unknown') {
      elements.push(elementType);
    }
  }

  if (elements.length === 0) {
    return 'Array<unknown>';
  }

  // Check if all elements have the same type
  const uniqueTypes = [...new Set(elements)];
  if (uniqueTypes.length === 1 && uniqueTypes[0]) {
    return `Array<${uniqueTypes[0]}>`;
  }

  return 'Array<unknown>';
}

/**
 * Infer type from a new expression.
 * Returns the class name being instantiated.
 */
function inferNewExpressionType(node: SyntaxNode): string {
  // Find the constructor (identifier or member_expression)
  for (const child of node.children) {
    if (child.type === 'identifier') {
      return child.text;
    }
    if (child.type === 'member_expression') {
      // Get the last property identifier
      const parts = extractMemberExpressionParts(child);
      return parts[parts.length - 1] ?? 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Extract all parts from a member expression.
 */
function extractMemberExpressionParts(node: SyntaxNode): string[] {
  const parts: string[] = [];
  let current: SyntaxNode | undefined = node;

  while (current) {
    if (current.type === 'member_expression') {
      // Find property_identifier
      for (const child of current.children) {
        if (child.type === 'property_identifier') {
          parts.unshift(child.text);
        }
      }
      // Move to object
      current = current.children[0];
    } else if (current.type === 'identifier') {
      parts.unshift(current.text);
      break;
    } else {
      break;
    }
  }

  return parts;
}

/**
 * Infer type from parenthesized expression.
 */
function inferParenthesizedType(node: SyntaxNode): string {
  for (const child of node.children) {
    if (child.type !== '(' && child.type !== ')') {
      return inferExpressionType(child);
    }
  }
  return 'unknown';
}

/**
 * Infer type from binary expression.
 */
function inferBinaryExpressionType(node: SyntaxNode): string {
  // Find the operator
  let operator: string | undefined;
  for (const child of node.children) {
    if (
      child.type === '+' ||
      child.type === '-' ||
      child.type === '*' ||
      child.type === '/' ||
      child.type === '%' ||
      child.type === '**' ||
      child.type === '==' ||
      child.type === '!=' ||
      child.type === '===' ||
      child.type === '!==' ||
      child.type === '<' ||
      child.type === '>' ||
      child.type === '<=' ||
      child.type === '>=' ||
      child.type === '&&' ||
      child.type === '||' ||
      child.type === '??' ||
      child.type === '&' ||
      child.type === '|' ||
      child.type === '^' ||
      child.type === '<<' ||
      child.type === '>>' ||
      child.type === '>>>' ||
      child.type === 'instanceof' ||
      child.type === 'in'
    ) {
      operator = child.type;
      break;
    }
  }

  if (!operator) return 'unknown';

  // Comparison and logical operators always return boolean
  if (
    ['==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||', 'instanceof', 'in'].includes(
      operator
    )
  ) {
    return 'boolean';
  }

  // Nullish coalescing - would need type analysis
  if (operator === '??') {
    return 'unknown';
  }

  // Arithmetic operators
  if (['+', '-', '*', '/', '%', '**'].includes(operator)) {
    // + can be string concatenation
    if (operator === '+') {
      // Check if either operand is a string
      const left = node.children[0];
      const right = node.children[2];
      if (left && right) {
        const leftType = inferExpressionType(left);
        const rightType = inferExpressionType(right);
        if (leftType === 'string' || rightType === 'string') {
          return 'string';
        }
      }
    }
    return 'number';
  }

  // Bitwise operators return number
  if (['&', '|', '^', '<<', '>>', '>>>'].includes(operator)) {
    return 'number';
  }

  return 'unknown';
}

/**
 * Infer type from unary expression.
 */
function inferUnaryExpressionType(node: SyntaxNode): string {
  // Find the operator
  let operator: string | undefined;
  for (const child of node.children) {
    if (
      child.type === '!' ||
      child.type === '~' ||
      child.type === '+' ||
      child.type === '-' ||
      child.type === 'typeof' ||
      child.type === 'void' ||
      child.type === 'delete'
    ) {
      operator = child.type;
      break;
    }
  }

  if (!operator) return 'unknown';

  switch (operator) {
    case '!':
      return 'boolean';
    case '~':
    case '+':
    case '-':
      return 'number';
    case 'typeof':
      return 'string';
    case 'void':
      return 'undefined';
    case 'delete':
      return 'boolean';
    default:
      return 'unknown';
  }
}

/**
 * Infer type from type assertion (as expression or angle bracket).
 */
function inferTypeAssertionType(node: SyntaxNode): string {
  // Find the type annotation
  for (const child of node.children) {
    if (child.type === 'type_identifier') {
      return child.text;
    }
    if (child.type === 'generic_type') {
      // Find the type identifier in generic type
      for (const genericChild of child.children) {
        if (genericChild.type === 'type_identifier') {
          return genericChild.text;
        }
      }
    }
    if (child.type === 'predefined_type') {
      return child.text;
    }
  }
  return 'unknown';
}

/**
 * Infer type from satisfies expression.
 * Returns unknown since satisfies doesn't change the type.
 */
function inferSatisfiesType(node: SyntaxNode): string {
  // The expression type is preserved, infer from the left side
  const expression = node.children[0];
  if (expression) {
    return inferExpressionType(expression);
  }
  return 'unknown';
}

/**
 * Infer type from non-null assertion (x!).
 * Returns the inner expression type (would need to remove null/undefined).
 */
function inferNonNullType(node: SyntaxNode): string {
  const expression = node.children[0];
  if (expression) {
    return inferExpressionType(expression);
  }
  return 'unknown';
}
