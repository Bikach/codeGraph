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
  ParsedCall,
  ParsedTypeAlias,
  ParsedConstructor,
  ParsedDestructuringDeclaration,
  ParsedObjectExpression,
} from '../../types.js';

import {
  findChildByType,
  traverseNode,
  nodeLocation,
  extractTypeName,
} from './extractor/ast-utils/index.js';
import { extractModifiers, extractAnnotations } from './extractor/modifiers/index.js';
import { inferArgumentType } from './extractor/calls/index.js';
import { extractPackageName, extractImports } from './extractor/package/index.js';
import { extractTypeParameters } from './extractor/generics/index.js';
import { extractProperty } from './extractor/property/index.js';
import {
  extractParameters,
  extractReturnType,
  extractReceiverType,
} from './extractor/function/index.js';

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
  result.objectExpressions = extractAllObjectExpressions(root);

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

function mapClassKind(node: SyntaxNode): ParsedClass['kind'] {
  // Check for interface/object/enum keywords as children
  const hasInterface = node.children.some((c) => c.type === 'interface');
  const hasObject = node.children.some((c) => c.type === 'object');
  const hasEnum = node.children.some((c) => c.type === 'enum');

  // Check for annotation class (modifier in modifiers > class_modifier > annotation)
  const modifiers = findChildByType(node, 'modifiers');
  const hasAnnotationModifier = modifiers?.children.some(
    (c) => c.type === 'class_modifier' && c.children.some((m) => m.type === 'annotation')
  );

  if (hasInterface) return 'interface';
  if (hasObject) return 'object';
  if (hasEnum) return 'enum';
  if (hasAnnotationModifier) return 'annotation';

  switch (node.type) {
    case 'object_declaration':
      return 'object';
    case 'enum_class_declaration':
      return 'enum';
    default:
      return 'class';
  }
}

function extractSuperTypes(classNode: SyntaxNode): { superClass?: string; interfaces: string[] } {
  let superClass: string | undefined;
  const interfaces: string[] = [];

  // delegation_specifier nodes are direct children of class_declaration
  // In Kotlin: superclass has constructor invocation (parentheses), interfaces don't
  // Example: class User : BaseEntity(), Serializable, Comparable<User>
  //          BaseEntity() -> superclass (has parentheses = constructor_invocation)
  //          Serializable, Comparable<User> -> interfaces (no parentheses = user_type only)
  for (const child of classNode.children) {
    if (child.type === 'delegation_specifier') {
      const constructorInvocation = findChildByType(child, 'constructor_invocation');
      const userType = findChildByType(child, 'user_type');

      if (constructorInvocation) {
        // This is a superclass (has constructor call with parentheses)
        // constructor_invocation contains user_type for the class name
        const typeNode = findChildByType(constructorInvocation, 'user_type');
        const typeName = typeNode ? extractTypeName(typeNode) : extractTypeName(constructorInvocation);
        if (typeName && !superClass) {
          // Only take the first one as superclass (Kotlin allows only one)
          superClass = typeName;
        } else if (typeName) {
          // Additional constructor invocations are rare but possible (delegation)
          interfaces.push(typeName);
        }
      } else if (userType) {
        // This is an interface (no constructor call)
        const typeName = extractTypeName(userType);
        if (typeName) {
          interfaces.push(typeName);
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
// Functions
// =============================================================================

function extractFunction(node: SyntaxNode): ParsedFunction {
  const nameNode = node.childForFieldName('name') ?? findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);
  const parameters = extractParameters(node);
  const returnType = extractReturnType(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

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
    isInline: modifiers.isInline,
    isInfix: modifiers.isInfix,
    isOperator: modifiers.isOperator,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations,
    location: nodeLocation(node),
    calls,
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
  // For qualified calls: com.example.Utils.method(args) has nested navigation_expressions

  const navigations = findChildByType(node, 'navigation_expression');
  const callSuffix = findChildByType(node, 'call_suffix');

  if (!callSuffix) return undefined;

  let name: string;
  let receiver: string | undefined;
  let isSafeCall = false;

  if (navigations) {
    // Extract the full receiver path and method name from navigation_expression
    const { receiverPath, methodName, hasSafeCall } = extractNavigationPath(navigations);
    receiver = receiverPath;
    name = methodName;
    isSafeCall = hasSafeCall;
  } else {
    // Direct function call
    const identifier = node.children.find((c) => c.type === 'simple_identifier');
    name = identifier?.text ?? '<unknown>';
  }

  // Extract argument information from call_suffix
  const { argumentCount, argumentTypes } = extractCallArguments(callSuffix);

  return {
    name,
    receiver,
    receiverType: undefined, // Will be resolved later
    argumentCount,
    argumentTypes: argumentTypes.length > 0 ? argumentTypes : undefined,
    isSafeCall: isSafeCall || undefined,
    location: nodeLocation(node),
  };
}

/**
 * Extract the full navigation path from a (possibly nested) navigation_expression.
 * Handles qualified calls like: com.example.Utils.method()
 * Returns the receiver path (com.example.Utils) and the method name (method).
 */
function extractNavigationPath(navExpr: SyntaxNode): {
  receiverPath: string | undefined;
  methodName: string;
  hasSafeCall: boolean;
} {
  // Collect all parts of the navigation path
  const parts: string[] = [];
  let hasSafeCall = false;

  // Recursively collect parts from nested navigation_expressions
  function collectParts(node: SyntaxNode): void {
    if (node.type === 'simple_identifier') {
      parts.push(node.text);
    } else if (node.type === 'navigation_expression') {
      // Process children in order
      for (const child of node.children) {
        if (child.type === 'navigation_expression' || child.type === 'simple_identifier') {
          collectParts(child);
        } else if (child.type === 'navigation_suffix') {
          // Check for safe call
          for (const suffixChild of child.children) {
            if (suffixChild.text === '?.' || suffixChild.type === '?.') {
              hasSafeCall = true;
            } else if (suffixChild.type === 'simple_identifier') {
              parts.push(suffixChild.text);
            }
          }
        }
      }
    }
  }

  collectParts(navExpr);

  // The last part is the method name, everything before is the receiver
  if (parts.length === 0) {
    return { receiverPath: undefined, methodName: '<unknown>', hasSafeCall };
  }

  if (parts.length === 1) {
    // Just a method call without receiver (shouldn't happen for navigation_expression)
    return { receiverPath: undefined, methodName: parts[0]!, hasSafeCall };
  }

  const methodName = parts.pop()!;
  const receiverPath = parts.join('.');

  return { receiverPath, methodName, hasSafeCall };
}

/**
 * Extract argument count and types from a call_suffix node.
 * Types are inferred from literals and simple expressions where possible.
 */
function extractCallArguments(callSuffix: SyntaxNode): { argumentCount: number; argumentTypes: string[] } {
  const argumentTypes: string[] = [];
  let argumentCount = 0;

  // call_suffix contains value_arguments which contains value_argument nodes
  const valueArguments = findChildByType(callSuffix, 'value_arguments');
  if (!valueArguments) {
    return { argumentCount: 0, argumentTypes: [] };
  }

  for (const child of valueArguments.children) {
    if (child.type === 'value_argument') {
      argumentCount++;
      const argType = inferArgumentType(child);
      argumentTypes.push(argType);
    }
  }

  return { argumentCount, argumentTypes };
}


// =============================================================================
// Primary Constructor Properties
// =============================================================================

function extractPrimaryConstructorProperties(classNode: SyntaxNode): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // Primary constructor is in primary_constructor node
  const primaryConstructor = findChildByType(classNode, 'primary_constructor');
  if (!primaryConstructor) return properties;

  // class_parameter nodes are direct children of primary_constructor (not in class_parameters)
  for (const child of primaryConstructor.children) {
    if (child.type === 'class_parameter') {
      // Check if it's a property (has val/var in binding_pattern_kind)
      const bindingKind = findChildByType(child, 'binding_pattern_kind');
      const hasVal = bindingKind?.children.some((c) => c.type === 'val') ?? false;
      const hasVar = bindingKind?.children.some((c) => c.type === 'var') ?? false;

      if (hasVal || hasVar) {
        const nameNode = findChildByType(child, 'simple_identifier');
        const typeNode =
          findChildByType(child, 'nullable_type') ??
          findChildByType(child, 'user_type') ??
          findChildByType(child, 'type_identifier');

        // Extract visibility from modifiers if present
        const modifiers = extractModifiers(child);

        properties.push({
          name: nameNode?.text ?? '<unnamed>',
          type: typeNode?.text,
          visibility: modifiers.visibility,
          isVal: hasVal,
          initializer: undefined, // Primary constructor props don't have initializers in declaration
          annotations: extractAnnotations(child),
          location: nodeLocation(child),
        });
      }
    }
  }

  return properties;
}

// =============================================================================
// Companion Objects
// =============================================================================

function isCompanionObject(node: SyntaxNode): boolean {
  // Check if the object declaration has 'companion' modifier
  const modifiers = findChildByType(node, 'modifiers');
  if (modifiers) {
    for (const child of modifiers.children) {
      if (child.type === 'class_modifier' && child.text === 'companion') {
        return true;
      }
    }
  }

  // Also check for 'companion' keyword as direct child
  return node.children.some((c) => c.type === 'companion');
}

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

// =============================================================================
// Secondary Constructors
// =============================================================================

function extractSecondaryConstructor(node: SyntaxNode): ParsedConstructor {
  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Extract parameters
  const params: ParsedParameter[] = [];
  const paramList = findChildByType(node, 'function_value_parameters');

  if (paramList) {
    for (const child of paramList.children) {
      if (child.type === 'parameter') {
        const nameNode = findChildByType(child, 'simple_identifier');
        const typeNode =
          findChildByType(child, 'nullable_type') ??
          findChildByType(child, 'user_type') ??
          findChildByType(child, 'type');

        params.push({
          name: nameNode?.text ?? '<unnamed>',
          type: typeNode?.text,
          annotations: extractAnnotations(child),
        });
      }
    }
  }

  // Check for delegation (this() or super())
  let delegatesTo: 'this' | 'super' | undefined;
  const constructorDelegationCall = findChildByType(node, 'constructor_delegation_call');
  if (constructorDelegationCall) {
    const delegationType = constructorDelegationCall.children.find(
      (c) => c.type === 'this' || c.type === 'super'
    );
    if (delegationType?.type === 'this') delegatesTo = 'this';
    if (delegationType?.type === 'super') delegatesTo = 'super';
  }

  return {
    parameters: params,
    visibility: modifiers.visibility,
    delegatesTo,
    annotations,
    location: nodeLocation(node),
  };
}

// =============================================================================
// Type Aliases
// =============================================================================

function extractTypeAlias(node: SyntaxNode): ParsedTypeAlias {
  const nameNode = findChildByType(node, 'type_identifier');
  const name = nameNode?.text ?? '<unnamed>';

  const modifiers = extractModifiers(node);

  // Extract type parameters if present
  const typeParameters = extractTypeParameters(node);

  // Extract the aliased type (after '=')
  let aliasedType = '';
  for (const child of node.children) {
    if (
      child.type === 'user_type' ||
      child.type === 'nullable_type' ||
      child.type === 'function_type'
    ) {
      // Check if preceded by '='
      const prev = child.previousSibling;
      if (prev?.type === '=') {
        aliasedType = child.text;
        break;
      }
    }
  }

  return {
    name,
    aliasedType,
    visibility: modifiers.visibility,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    location: nodeLocation(node),
  };
}

// =============================================================================
// Destructuring Declarations
// =============================================================================

function extractDestructuringDeclaration(
  node: SyntaxNode
): ParsedDestructuringDeclaration | undefined {
  // Check if this is a destructuring declaration
  // Structure: property_declaration > multi_variable_declaration > variable_declaration+
  const multiVarDecl = findChildByType(node, 'multi_variable_declaration');
  if (!multiVarDecl) return undefined;

  const componentNames: string[] = [];
  const componentTypes: (string | undefined)[] = [];

  for (const child of multiVarDecl.children) {
    if (child.type === 'variable_declaration') {
      const nameNode = findChildByType(child, 'simple_identifier');
      const typeNode =
        findChildByType(child, 'nullable_type') ??
        findChildByType(child, 'user_type');

      componentNames.push(nameNode?.text ?? '_');
      componentTypes.push(typeNode?.text);
    }
  }

  if (componentNames.length === 0) return undefined;

  const modifiers = extractModifiers(node);
  const bindingKind = findChildByType(node, 'binding_pattern_kind');
  const isVal = bindingKind
    ? bindingKind.children.some((c) => c.type === 'val')
    : node.children.some((c) => c.type === 'val');

  // Get initializer
  const initializer = node.childForFieldName('initializer');

  return {
    componentNames,
    componentTypes: componentTypes.some((t) => t !== undefined) ? componentTypes : undefined,
    initializer: initializer?.text,
    visibility: modifiers.visibility,
    isVal,
    location: nodeLocation(node),
  };
}

// =============================================================================
// Object Expressions
// =============================================================================

function extractAllObjectExpressions(root: SyntaxNode): ParsedObjectExpression[] {
  const expressions: ParsedObjectExpression[] = [];

  traverseNode(root, (node) => {
    if (node.type === 'object_literal') {
      const expr = extractObjectExpression(node);
      if (expr) {
        expressions.push(expr);
      }
    }
  });

  return expressions;
}

function extractObjectExpression(node: SyntaxNode): ParsedObjectExpression | undefined {
  // object_literal: object [: delegation_specifiers] { class_body }
  const superTypes: string[] = [];

  // Extract implemented interfaces/extended classes
  for (const child of node.children) {
    if (child.type === 'delegation_specifier') {
      const typeRef =
        findChildByType(child, 'user_type') ?? findChildByType(child, 'constructor_invocation');
      if (typeRef) {
        const typeName = extractTypeName(typeRef);
        if (typeName) {
          superTypes.push(typeName);
        }
      }
    }
  }

  const classBody = findChildByType(node, 'class_body');
  const { properties, functions } = extractClassBody(classBody);

  return {
    superTypes,
    properties,
    functions,
    location: nodeLocation(node),
  };
}

