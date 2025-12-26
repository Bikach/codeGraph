/**
 * Kotlin Symbol Extractor
 *
 * Traverses the tree-sitter AST and extracts Kotlin symbols into
 * the normalized ParsedFile format.
 */

import type { SyntaxNode, Tree } from 'tree-sitter';
import type {
  ParsedFile,
  ParsedClass,
  ParsedFunction,
  ParsedProperty,
  ParsedConstructor,
} from '../../types.js';

import { findChildByType, nodeLocation } from './extractor/ast-utils/index.js';
import { extractModifiers, extractAnnotations } from './extractor/modifiers/index.js';
import { extractPackageName, extractImports } from './extractor/package/index.js';
import { extractTypeParameters } from './extractor/generics/index.js';
import { extractProperty } from './extractor/property/index.js';
import { extractFunction } from './extractor/function/index.js';
import {
  extractPrimaryConstructorProperties,
  extractSecondaryConstructor,
} from './extractor/constructor/index.js';
import { isCompanionObject } from './extractor/companion/index.js';
import { mapClassKind, extractSuperTypes } from './extractor/class/index.js';
import {
  extractTypeAlias,
  extractDestructuringDeclaration,
} from './extractor/advanced/index.js';
import { extractAllObjectExpressions } from './extractor/object-expressions/index.js';

// =============================================================================
// Main Extractor
// =============================================================================

/**
 * Extract all symbols from a Kotlin AST.
 */
export function extractSymbols(tree: Tree, filePath: string): ParsedFile {
  const root = tree.rootNode;

  const result: ParsedFile = {
    filePath,
    language: 'kotlin',
    packageName: extractPackageName(root),
    imports: extractImports(root),
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
  };

  // Traverse top-level declarations
  for (const child of root.children) {
    switch (child.type) {
      case 'class_declaration':
      case 'interface_declaration':
      case 'object_declaration':
      case 'enum_class_declaration':
      case 'annotation_declaration':
        result.classes.push(extractClass(child));
        break;

      case 'function_declaration':
        result.topLevelFunctions.push(extractFunction(child));
        break;

      case 'property_declaration': {
        // Check for destructuring declaration
        const destructuring = extractDestructuringDeclaration(child);
        if (destructuring) {
          result.destructuringDeclarations.push(destructuring);
        } else {
          result.topLevelProperties.push(extractProperty(child));
        }
        break;
      }

      case 'type_alias':
        result.typeAliases.push(extractTypeAlias(child));
        break;
    }
  }

  // Extract object expressions from all function bodies for dependency tracking
  result.objectExpressions = extractAllObjectExpressions(root, extractClassBody);

  return result;
}

// =============================================================================
// Classes / Interfaces / Objects
// =============================================================================

function extractClass(node: SyntaxNode): ParsedClass {
  const kind = mapClassKind(node);
  const nameNode =
    node.childForFieldName('name') ??
    findChildByType(node, 'type_identifier') ??
    findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Extract super types (delegation_specifier nodes are direct children of class_declaration)
  const { superClass, interfaces } = extractSuperTypes(node);

  // Extract primary constructor properties
  const primaryConstructorProps = extractPrimaryConstructorProperties(node);

  // Extract body members
  const classBody = findChildByType(node, 'class_body') ?? findChildByType(node, 'enum_class_body');
  const { properties, functions, nestedClasses, companionObject, secondaryConstructors } = extractClassBody(classBody);

  // Merge primary constructor properties with body properties
  const allProperties = [...primaryConstructorProps, ...properties];

  return {
    name,
    kind,
    visibility: modifiers.visibility,
    isAbstract: modifiers.isAbstract,
    isData: modifiers.isData,
    isSealed: modifiers.isSealed,
    superClass,
    interfaces,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations,
    properties: allProperties,
    functions,
    nestedClasses,
    companionObject,
    secondaryConstructors: secondaryConstructors.length > 0 ? secondaryConstructors : undefined,
    location: nodeLocation(node),
  };
}

function extractClassBody(classBody: SyntaxNode | undefined): {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
  companionObject?: ParsedClass;
  secondaryConstructors: ParsedConstructor[];
} {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];
  const nestedClasses: ParsedClass[] = [];
  const secondaryConstructors: ParsedConstructor[] = [];
  let companionObject: ParsedClass | undefined = undefined;

  if (!classBody) {
    return { properties, functions, nestedClasses, companionObject, secondaryConstructors };
  }

  for (const child of classBody.children) {
    switch (child.type) {
      case 'property_declaration':
        properties.push(extractProperty(child));
        break;

      case 'function_declaration':
        functions.push(extractFunction(child));
        break;

      case 'class_declaration':
      case 'interface_declaration':
      case 'enum_class_declaration':
        nestedClasses.push(extractClass(child));
        break;

      case 'object_declaration':
        // Check if this is a companion object
        if (isCompanionObject(child)) {
          companionObject = extractClass(child);
        } else {
          nestedClasses.push(extractClass(child));
        }
        break;

      case 'companion_object':
        companionObject = extractCompanionObject(child);
        break;

      case 'secondary_constructor':
        secondaryConstructors.push(extractSecondaryConstructor(child));
        break;
    }
  }

  return { properties, functions, nestedClasses, companionObject, secondaryConstructors };
}

// =============================================================================
// Companion Objects
// =============================================================================

function extractCompanionObject(node: SyntaxNode): ParsedClass {
  // companion_object has similar structure to object_declaration
  const nameNode = findChildByType(node, 'type_identifier') ?? findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? 'Companion';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  const classBody = findChildByType(node, 'class_body');
  const { properties, functions, nestedClasses } = extractClassBody(classBody);

  return {
    name,
    kind: 'object',
    visibility: modifiers.visibility,
    isAbstract: false,
    isData: false,
    isSealed: false,
    superClass: undefined,
    interfaces: [],
    annotations,
    properties,
    functions,
    nestedClasses,
    location: nodeLocation(node),
  };
}


