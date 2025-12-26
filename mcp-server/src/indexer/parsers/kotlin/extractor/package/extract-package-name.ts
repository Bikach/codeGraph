/**
 * Extract package name from Kotlin source file.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract the package name from the root of a Kotlin AST.
 * Returns undefined if no package declaration is found.
 */
export function extractPackageName(root: SyntaxNode): string | undefined {
  const packageHeader = root.children.find((c) => c.type === 'package_header');
  if (!packageHeader) return undefined;

  const identifier = findChildByType(packageHeader, 'identifier');
  return identifier?.text;
}
