/**
 * Extract interface body members from an interface_body or object_type AST node.
 *
 * This function extracts property signatures and method signatures
 * from a TypeScript interface body.
 *
 * TypeScript interface body can contain:
 * - property_signature: property declaration
 * - method_signature: method declaration
 * - call_signature: callable interface
 * - construct_signature: newable interface
 * - index_signature: index signature [key: string]: value
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction, ParsedProperty } from '../../../../types.js';
import { extractPropertySignature } from '../property/index.js';
import { extractMethodSignature } from '../function/index.js';
import { nodeLocation } from '../ast-utils/index.js';

/**
 * Result of extracting interface body members.
 */
export interface InterfaceBodyResult {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
}

/**
 * Extract all members from a TypeScript interface body AST node.
 *
 * @param interfaceBody - The interface_body or object_type AST node (can be undefined)
 * @returns InterfaceBodyResult with all extracted members
 */
export function extractInterfaceBody(interfaceBody: SyntaxNode | undefined): InterfaceBodyResult {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];

  if (!interfaceBody) {
    return { properties, functions };
  }

  for (const child of interfaceBody.children) {
    switch (child.type) {
      // Property signatures
      case 'property_signature':
        properties.push(extractPropertySignature(child));
        break;

      // Method signatures
      case 'method_signature':
        functions.push(extractMethodSignature(child));
        break;

      // Call signatures (callable interface)
      case 'call_signature':
        // Treat as a special method named 'call'
        // This is a simplification; full support would need a different structure
        functions.push({
          name: '[[call]]',
          visibility: 'public',
          parameters: [], // Would need proper extraction
          isAbstract: true,
          isSuspend: false,
          isExtension: false,
          annotations: [],
          location: nodeLocation(child),
          calls: [],
        });
        break;

      // Construct signatures (newable interface)
      case 'construct_signature':
        // Treat as a special method named 'new'
        functions.push({
          name: '[[construct]]',
          visibility: 'public',
          parameters: [],
          isAbstract: true,
          isSuspend: false,
          isExtension: false,
          annotations: [],
          location: nodeLocation(child),
          calls: [],
        });
        break;

      // Index signatures [key: string]: value
      case 'index_signature':
        // Treated as a special property
        properties.push({
          name: '[[index]]',
          type: child.text,
          visibility: 'public',
          isVal: false,
          annotations: [],
          location: nodeLocation(child),
        });
        break;

      // Punctuation and comments
      case ';':
      case '{':
      case '}':
      case ',':
      case 'comment':
        break;
    }
  }

  return { properties, functions };
}
