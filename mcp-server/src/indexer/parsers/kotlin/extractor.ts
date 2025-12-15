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
  ParsedParameter,
  ParsedImport,
  ParsedAnnotation,
  ParsedCall,
  SourceLocation,
  Visibility,
} from '../../types.js';

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
    packageName: extractPackageName(root),
    imports: extractImports(root),
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
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

      case 'property_declaration':
        result.topLevelProperties.push(extractProperty(child));
        break;
    }
  }

  return result;
}

// =============================================================================
// Package & Imports
// =============================================================================

function extractPackageName(root: SyntaxNode): string | undefined {
  const packageHeader = root.children.find((c) => c.type === 'package_header');
  if (!packageHeader) return undefined;

  const identifier = findChildByType(packageHeader, 'identifier');
  return identifier?.text;
}

function extractImports(root: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  // Imports are inside import_list
  const importList = root.children.find((c) => c.type === 'import_list');
  const importHeaders = importList ? importList.children : root.children;

  for (const child of importHeaders) {
    if (child.type === 'import_header') {
      const identifier = findChildByType(child, 'identifier');
      if (identifier) {
        const path = identifier.text;
        // Wildcard can be: path ends with *, STAR node, or wildcard_import node
        const isWildcard =
          path.endsWith('*') ||
          child.children.some((c) => c.type === 'STAR' || c.type === 'wildcard_import');
        const aliasNode = findChildByType(child, 'import_alias');

        imports.push({
          path: path.replace(/\.\*$/, ''),
          alias: aliasNode ? findChildByType(aliasNode, 'simple_identifier')?.text : undefined,
          isWildcard,
        });
      }
    }
  }

  return imports;
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

  // Extract super types
  const delegationSpecifiers = findChildByType(node, 'delegation_specifiers');
  const { superClass, interfaces } = extractSuperTypes(delegationSpecifiers, kind);

  // Extract body members
  const classBody = findChildByType(node, 'class_body') ?? findChildByType(node, 'enum_class_body');
  const { properties, functions, nestedClasses } = extractClassBody(classBody);

  return {
    name,
    kind,
    visibility: modifiers.visibility,
    isAbstract: modifiers.isAbstract,
    isData: modifiers.isData,
    isSealed: modifiers.isSealed,
    superClass,
    interfaces,
    annotations,
    properties,
    functions,
    nestedClasses,
    location: nodeLocation(node),
  };
}

function mapClassKind(node: SyntaxNode): ParsedClass['kind'] {
  // Check for interface/object/enum keywords as children
  const hasInterface = node.children.some((c) => c.type === 'interface');
  const hasObject = node.children.some((c) => c.type === 'object');
  const hasEnum = node.children.some((c) => c.type === 'enum');
  const hasAnnotation = node.children.some((c) => c.type === 'annotation');

  if (hasInterface) return 'interface';
  if (hasObject) return 'object';
  if (hasEnum) return 'enum';
  if (hasAnnotation) return 'annotation';

  switch (node.type) {
    case 'object_declaration':
      return 'object';
    case 'enum_class_declaration':
      return 'enum';
    default:
      return 'class';
  }
}

function extractSuperTypes(
  delegationSpecifiers: SyntaxNode | undefined,
  kind: ParsedClass['kind']
): { superClass?: string; interfaces: string[] } {
  if (!delegationSpecifiers) {
    return { superClass: undefined, interfaces: [] };
  }

  const superClass: string | undefined = undefined;
  const interfaces: string[] = [];

  for (const child of delegationSpecifiers.children) {
    if (child.type === 'delegation_specifier') {
      const typeRef = findChildByType(child, 'user_type') ?? findChildByType(child, 'constructor_invocation');
      if (typeRef) {
        const typeName = extractTypeName(typeRef);
        if (typeName) {
          // In Kotlin, the first type is the superclass (if class), rest are interfaces
          // For interfaces, all are super-interfaces
          if (kind === 'interface') {
            interfaces.push(typeName);
          } else if (interfaces.length === 0) {
            // First one could be class or interface - we can't know without type resolution
            // For now, treat first as superClass, rest as interfaces
            interfaces.push(typeName);
          } else {
            interfaces.push(typeName);
          }
        }
      }
    }
  }

  return { superClass, interfaces };
}

function extractClassBody(classBody: SyntaxNode | undefined): {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
} {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];
  const nestedClasses: ParsedClass[] = [];

  if (!classBody) {
    return { properties, functions, nestedClasses };
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
      case 'object_declaration':
      case 'enum_class_declaration':
        nestedClasses.push(extractClass(child));
        break;
    }
  }

  return { properties, functions, nestedClasses };
}

// =============================================================================
// Functions
// =============================================================================

function extractFunction(node: SyntaxNode): ParsedFunction {
  const nameNode = node.childForFieldName('name') ?? findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);
  const parameters = extractParameters(node);
  const returnType = extractReturnType(node);

  // Check for extension function
  const receiverType = extractReceiverType(node);

  // Extract function calls from body
  const body = findChildByType(node, 'function_body');
  const calls = body ? extractCalls(body) : [];

  return {
    name,
    visibility: modifiers.visibility,
    parameters,
    returnType,
    isAbstract: modifiers.isAbstract,
    isSuspend: modifiers.isSuspend,
    isExtension: !!receiverType,
    receiverType,
    annotations,
    location: nodeLocation(node),
    calls,
  };
}

function extractParameters(node: SyntaxNode): ParsedParameter[] {
  const params: ParsedParameter[] = [];
  const paramList = findChildByType(node, 'function_value_parameters');

  if (!paramList) return params;

  for (const child of paramList.children) {
    if (child.type === 'parameter') {
      const nameNode = findChildByType(child, 'simple_identifier');
      const typeNode = findChildByType(child, 'type');
      const defaultValue = findChildByType(child, 'default_value');

      params.push({
        name: nameNode?.text ?? '<unnamed>',
        type: typeNode?.text,
        defaultValue: defaultValue?.text,
        annotations: extractAnnotations(child),
      });
    }
  }

  return params;
}

function extractReturnType(node: SyntaxNode): string | undefined {
  const typeNode = node.childForFieldName('type') ?? findChildByType(node, 'type');
  // Skip if type is a parameter type
  if (typeNode && typeNode.parent?.type === 'function_declaration') {
    return typeNode.text;
  }
  return undefined;
}

function extractReceiverType(node: SyntaxNode): string | undefined {
  const receiverType = node.childForFieldName('receiver_type');
  if (receiverType) {
    return receiverType.text;
  }

  // Extension function: user_type before the dot, e.g., "fun String.capitalize()"
  // AST: [user_type] [.] [simple_identifier]
  const userType = findChildByType(node, 'user_type');
  if (userType) {
    const nextSibling = userType.nextSibling;
    if (nextSibling?.type === '.') {
      return userType.text;
    }
  }

  return undefined;
}

// =============================================================================
// Properties
// =============================================================================

function extractProperty(node: SyntaxNode): ParsedProperty {
  // Property name is in variable_declaration > simple_identifier
  const varDecl = findChildByType(node, 'variable_declaration');
  const nameNode =
    node.childForFieldName('name') ??
    (varDecl ? findChildByType(varDecl, 'simple_identifier') : null) ??
    findChildByType(node, 'simple_identifier');

  const name = nameNode?.text ?? '<unnamed>';
  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Check if val or var (can be in binding_pattern_kind or directly)
  const bindingKind = findChildByType(node, 'binding_pattern_kind');
  const isVal = bindingKind
    ? bindingKind.children.some((c) => c.type === 'val')
    : node.children.some((c) => c.type === 'val');

  // Extract type from variable_declaration > user_type
  const typeNode = varDecl ? findChildByType(varDecl, 'user_type') : findChildByType(node, 'type');
  const type = typeNode?.text;

  // Extract initializer
  const initializer = findChildByType(node, 'property_delegate') ?? node.childForFieldName('initializer');

  return {
    name,
    type,
    visibility: modifiers.visibility,
    isVal,
    initializer: initializer?.text,
    annotations,
    location: nodeLocation(node),
  };
}

// =============================================================================
// Function Calls
// =============================================================================

function extractCalls(body: SyntaxNode): ParsedCall[] {
  const calls: ParsedCall[] = [];

  traverseNode(body, (node) => {
    if (node.type === 'call_expression') {
      const call = extractCallExpression(node);
      if (call) {
        calls.push(call);
      }
    }
  });

  return calls;
}

function extractCallExpression(node: SyntaxNode): ParsedCall | undefined {
  // call_expression has structure: receiver.function_name(args)
  // or just: function_name(args)

  const navigations = findChildByType(node, 'navigation_expression');
  const callSuffix = findChildByType(node, 'call_suffix');

  if (!callSuffix) return undefined;

  let name: string;
  let receiver: string | undefined;

  if (navigations) {
    // receiver.method() pattern
    const parts = navigations.children.filter((c) => c.type !== 'navigation_suffix');
    receiver = parts[0]?.text;

    const navSuffix = findChildByType(navigations, 'navigation_suffix');
    const methodName = navSuffix?.children.find((c) => c.type === 'simple_identifier');
    name = methodName?.text ?? '<unknown>';
  } else {
    // Direct function call
    const identifier = node.children.find((c) => c.type === 'simple_identifier');
    name = identifier?.text ?? '<unknown>';
  }

  return {
    name,
    receiver,
    receiverType: undefined, // Will be resolved later
    location: nodeLocation(node),
  };
}

// =============================================================================
// Modifiers & Annotations
// =============================================================================

interface Modifiers {
  visibility: Visibility;
  isAbstract: boolean;
  isData: boolean;
  isSealed: boolean;
  isSuspend: boolean;
}

function extractModifiers(node: SyntaxNode): Modifiers {
  const result: Modifiers = {
    visibility: 'public',
    isAbstract: false,
    isData: false,
    isSealed: false,
    isSuspend: false,
  };

  const modifiersList = findChildByType(node, 'modifiers');
  if (!modifiersList) return result;

  for (const child of modifiersList.children) {
    switch (child.type) {
      case 'visibility_modifier':
        result.visibility = mapVisibility(child.text);
        break;
      case 'inheritance_modifier':
        if (child.text === 'abstract') result.isAbstract = true;
        if (child.text === 'sealed') result.isSealed = true;
        break;
      case 'class_modifier':
        if (child.text === 'data') result.isData = true;
        if (child.text === 'sealed') result.isSealed = true;
        break;
      case 'function_modifier':
        if (child.text === 'suspend') result.isSuspend = true;
        break;
    }
  }

  return result;
}

function mapVisibility(text: string): Visibility {
  switch (text) {
    case 'private':
      return 'private';
    case 'protected':
      return 'protected';
    case 'internal':
      return 'internal';
    default:
      return 'public';
  }
}

function extractAnnotations(node: SyntaxNode): ParsedAnnotation[] {
  const annotations: ParsedAnnotation[] = [];
  const modifiersList = findChildByType(node, 'modifiers');

  if (!modifiersList) return annotations;

  for (const child of modifiersList.children) {
    if (child.type === 'annotation') {
      const nameNode = findChildByType(child, 'user_type') ?? findChildByType(child, 'simple_identifier');
      if (nameNode) {
        annotations.push({
          name: nameNode.text,
          arguments: undefined, // TODO: extract annotation arguments
        });
      }
    }
  }

  return annotations;
}

// =============================================================================
// Helpers
// =============================================================================

function findChildByType(node: SyntaxNode, type: string): SyntaxNode | undefined {
  return node.children.find((c) => c.type === type);
}

function extractTypeName(typeNode: SyntaxNode): string | undefined {
  if (typeNode.type === 'user_type') {
    const identifier = findChildByType(typeNode, 'simple_identifier');
    return identifier?.text ?? typeNode.text;
  }
  if (typeNode.type === 'constructor_invocation') {
    const userType = findChildByType(typeNode, 'user_type');
    return userType ? extractTypeName(userType) : typeNode.text;
  }
  return typeNode.text;
}

function nodeLocation(node: SyntaxNode): SourceLocation {
  return {
    filePath: '', // Will be set by caller
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column + 1,
  };
}

function traverseNode(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (const child of node.children) {
    traverseNode(child, callback);
  }
}
