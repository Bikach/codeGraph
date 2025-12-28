/**
 * Extract package name from Java source file.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract the package name from the root of a Java AST.
 * Returns undefined if no package declaration is found.
 *
 * Java AST structure:
 * - package_declaration
 *   - scoped_identifier (e.g., "com.example.app")
 */
export function extractPackageName(root: SyntaxNode): string | undefined {
  const packageDecl = root.children.find((c) => c.type === 'package_declaration');
  if (!packageDecl) return undefined;

  // Package name can be a scoped_identifier or identifier
  const scopedId = findChildByType(packageDecl, 'scoped_identifier');
  if (scopedId) return scopedId.text;

  const identifier = findChildByType(packageDecl, 'identifier');
  return identifier?.text;
}
