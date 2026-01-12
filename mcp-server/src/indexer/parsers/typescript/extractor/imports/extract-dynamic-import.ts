/**
 * Extract dynamic import() expressions from a TypeScript/JavaScript AST.
 *
 * Handles patterns like:
 * - const module = await import('./module')
 * - import('./lazy').then(m => m.default)
 * - const { foo } = await import(`./dynamic/${name}`)
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { traverseNode, findChildByType } from '../ast-utils/index.js';

interface ModuleSpecifierResult {
  path: string;
  isTemplateLiteral: boolean;
}

/**
 * Extract the module specifier from a dynamic import call.
 * Handles both string literals and template literals.
 *
 * @param argsNode - The arguments node of the import call
 * @returns Object containing path and template literal flag, or undefined if not extractable
 */
function extractModuleSpecifier(argsNode: SyntaxNode): ModuleSpecifierResult | undefined {
  const stringNode = findChildByType(argsNode, 'string');
  if (stringNode) {
    return {
      path: stringNode.text.slice(1, -1), // Remove quotes
      isTemplateLiteral: false,
    };
  }

  const templateNode = findChildByType(argsNode, 'template_string');
  if (templateNode) {
    return {
      path: templateNode.text,
      isTemplateLiteral: true,
    };
  }

  return undefined;
}

/**
 * Extract dynamic import() expressions from a TypeScript/JavaScript AST.
 *
 * Dynamic imports are call_expression nodes where the function is 'import'.
 * They can appear anywhere in the code, not just at the top level.
 */
export function extractDynamicImports(root: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  traverseNode(root, (node) => {
    // Dynamic imports are call_expression with 'import' as the function
    if (node.type === 'call_expression') {
      const funcNode = node.children[0];

      // Check if this is a dynamic import: import(...)
      if (funcNode?.type === 'import') {
        const argsNode = findChildByType(node, 'arguments');
        if (argsNode) {
          const result = extractModuleSpecifier(argsNode);
          if (result) {
            imports.push({
              path: result.path,
              isDynamic: true,
              isTemplateLiteral: result.isTemplateLiteral || undefined,
            });
          }
        }
      }
    }
  });

  return imports;
}
