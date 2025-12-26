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
  ParsedTypeAlias,
  ParsedTypeParameter,
  ParsedConstructor,
  ParsedDestructuringDeclaration,
  ParsedObjectExpression,
  ParsedFunctionType,
  Visibility,
} from '../../types.js';

import {
  findChildByType,
  traverseNode,
  nodeLocation,
  extractTypeName,
} from './extractor/ast-utils/index.js';

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
          alias: aliasNode
            ? (findChildByType(aliasNode, 'type_identifier') ?? findChildByType(aliasNode, 'simple_identifier'))?.text
            : undefined,
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

function extractParameters(node: SyntaxNode): ParsedParameter[] {
  const params: ParsedParameter[] = [];
  const paramList = findChildByType(node, 'function_value_parameters');

  if (!paramList) return params;

  // Track pending modifiers (they appear as siblings before each parameter)
  let pendingModifiers: SyntaxNode | null = null;

  for (const child of paramList.children) {
    if (child.type === 'parameter_modifiers') {
      pendingModifiers = child;
      continue;
    }

    if (child.type === 'parameter') {
      const nameNode = findChildByType(child, 'simple_identifier');
      // Type can be: user_type (String), nullable_type (User?), function_type, or other type nodes
      const functionTypeNode = findChildByType(child, 'function_type');
      const typeNode =
        functionTypeNode ??
        findChildByType(child, 'nullable_type') ??
        findChildByType(child, 'user_type') ??
        findChildByType(child, 'type');
      const defaultValue = findChildByType(child, 'default_value');

      // Extract function type for lambda parameters
      let functionType: ParsedFunctionType | undefined;
      if (functionTypeNode) {
        functionType = extractFunctionType(functionTypeNode, child);
      }

      // Check for crossinline/noinline modifiers
      let isCrossinline = false;
      let isNoinline = false;
      if (pendingModifiers) {
        for (const mod of pendingModifiers.children) {
          if (mod.type === 'parameter_modifier') {
            if (mod.text === 'crossinline') isCrossinline = true;
            if (mod.text === 'noinline') isNoinline = true;
          }
        }
        pendingModifiers = null; // Reset after processing
      }

      params.push({
        name: nameNode?.text ?? '<unnamed>',
        type: typeNode?.text,
        functionType,
        defaultValue: defaultValue?.text,
        annotations: extractAnnotations(child),
        isCrossinline: isCrossinline || undefined,
        isNoinline: isNoinline || undefined,
      });
    }
  }

  return params;
}

function extractReturnType(node: SyntaxNode): string | undefined {
  // Return type can be: nullable_type (User?), user_type (User), or other type nodes
  // They appear after ':' and before function_body in function_declaration
  for (const child of node.children) {
    // Skip parameter types (they are inside function_value_parameters)
    if (
      child.type === 'nullable_type' ||
      child.type === 'user_type' ||
      child.type === 'type_identifier'
    ) {
      // Make sure it's not the receiver type (comes before the function name)
      const prevSibling = child.previousSibling;
      if (prevSibling?.type === ':') {
        return child.text;
      }
    }
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

/**
 * Extracts a function type from a function_type AST node.
 * Handles: (Int, String) -> Boolean, Int.(String) -> Boolean, suspend () -> Unit
 */
function extractFunctionType(
  node: SyntaxNode,
  parentNode?: SyntaxNode
): ParsedFunctionType | undefined {
  if (node.type !== 'function_type') return undefined;

  const parameterTypes: string[] = [];
  let returnType = 'Unit';
  let receiverType: string | undefined;

  // Check for suspend modifier in preceding type_modifiers sibling
  let isSuspend = false;
  if (parentNode) {
    for (const child of parentNode.children) {
      if (child.type === 'type_modifiers') {
        for (const mod of child.children) {
          if (mod.text === 'suspend') {
            isSuspend = true;
            break;
          }
        }
      }
    }
  }

  // Process function_type children
  // Pattern 1: function_type_parameters -> -> return_type
  // Pattern 2: receiver_type . function_type_parameters -> -> return_type
  let foundArrow = false;

  for (const child of node.children) {
    if (child.type === 'type_identifier' && !foundArrow) {
      // This could be the receiver type (before the dot)
      const nextSibling = child.nextSibling;
      if (nextSibling?.type === '.') {
        receiverType = child.text;
      }
    } else if (child.type === 'function_type_parameters') {
      // Extract parameter types from function_type_parameters
      for (const paramChild of child.children) {
        if (
          paramChild.type === 'user_type' ||
          paramChild.type === 'nullable_type' ||
          paramChild.type === 'function_type'
        ) {
          parameterTypes.push(paramChild.text);
        }
      }
    } else if (child.type === '->') {
      foundArrow = true;
    } else if (
      foundArrow &&
      (child.type === 'user_type' ||
        child.type === 'nullable_type' ||
        child.type === 'type_identifier')
    ) {
      // Return type comes after ->
      returnType = child.text;
    }
  }

  return {
    parameterTypes,
    returnType,
    isSuspend,
    receiverType,
  };
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

  // Extract type from variable_declaration (can be user_type or nullable_type)
  const typeNode = varDecl
    ? findChildByType(varDecl, 'nullable_type') ?? findChildByType(varDecl, 'user_type')
    : findChildByType(node, 'nullable_type') ?? findChildByType(node, 'user_type') ?? findChildByType(node, 'type');
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

/**
 * Infer the type of an argument from its expression.
 * Returns the inferred type or 'Unknown' if it cannot be determined.
 */
function inferArgumentType(valueArgument: SyntaxNode): string {
  // value_argument may contain: expression, named argument (name = expression), or spread (*array)
  // Skip the name part for named arguments
  const expression = findFirstExpression(valueArgument);
  if (!expression) return 'Unknown';

  return inferExpressionType(expression);
}

/**
 * Find the first expression in a node (skips named argument labels).
 */
function findFirstExpression(node: SyntaxNode): SyntaxNode | undefined {
  for (const child of node.children) {
    // Skip identifier and '=' for named arguments
    if (child.type === 'simple_identifier' || child.text === '=') continue;
    // Common expression types
    if (isExpressionType(child.type)) {
      return child;
    }
  }
  return undefined;
}

/**
 * Check if a node type is an expression type.
 */
function isExpressionType(type: string): boolean {
  const expressionTypes = [
    'integer_literal',
    'long_literal',
    'real_literal',
    'string_literal',
    'character_literal',
    'boolean_literal',
    'null_literal',
    'call_expression',
    'navigation_expression',
    'simple_identifier',
    'prefix_expression',
    'postfix_expression',
    'additive_expression',
    'multiplicative_expression',
    'comparison_expression',
    'equality_expression',
    'conjunction_expression',
    'disjunction_expression',
    'lambda_literal',
    'object_literal',
    'collection_literal',
    'if_expression',
    'when_expression',
    'try_expression',
    'parenthesized_expression',
  ];
  return expressionTypes.includes(type);
}

/**
 * Infer type from an expression node.
 */
function inferExpressionType(expression: SyntaxNode): string {
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

// =============================================================================
// Modifiers & Annotations
// =============================================================================

interface Modifiers {
  visibility: Visibility;
  isAbstract: boolean;
  isData: boolean;
  isSealed: boolean;
  isSuspend: boolean;
  isInline: boolean;
  isInfix: boolean;
  isOperator: boolean;
}

function extractModifiers(node: SyntaxNode): Modifiers {
  const result: Modifiers = {
    visibility: 'public',
    isAbstract: false,
    isData: false,
    isSealed: false,
    isSuspend: false,
    isInline: false,
    isInfix: false,
    isOperator: false,
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
        if (child.text === 'inline') result.isInline = true;
        if (child.text === 'infix') result.isInfix = true;
        if (child.text === 'operator') result.isOperator = true;
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
      // Annotation can be:
      // - @Name -> user_type directly
      // - @Name("arg") -> constructor_invocation > user_type
      const constructorInvocation = findChildByType(child, 'constructor_invocation');
      const nameNode = constructorInvocation
        ? findChildByType(constructorInvocation, 'user_type')
        : findChildByType(child, 'user_type') ?? findChildByType(child, 'simple_identifier');

      if (nameNode) {
        // Extract just the annotation name (e.g., "Deprecated" not "Deprecated(\"msg\")")
        const typeIdentifier = findChildByType(nameNode, 'type_identifier');
        annotations.push({
          name: typeIdentifier?.text ?? nameNode.text,
          arguments: extractAnnotationArguments(child),
        });
      }
    }
  }

  return annotations;
}


// =============================================================================
// Type Parameters (Generics)
// =============================================================================

function extractTypeParameters(node: SyntaxNode): ParsedTypeParameter[] {
  const typeParams: ParsedTypeParameter[] = [];
  const typeParamList = findChildByType(node, 'type_parameters');

  if (!typeParamList) return typeParams;

  for (const child of typeParamList.children) {
    if (child.type === 'type_parameter') {
      const typeParam = extractSingleTypeParameter(child);
      if (typeParam) {
        typeParams.push(typeParam);
      }
    }
  }

  // Handle where clause (multiple type bounds)
  // AST: type_constraints > where, type_constraint, [,], type_constraint, ...
  const typeConstraints = findChildByType(node, 'type_constraints');
  if (typeConstraints) {
    for (const constraintNode of typeConstraints.children) {
      if (constraintNode.type === 'type_constraint') {
        // type_constraint > type_identifier, :, user_type
        const typeId = findChildByType(constraintNode, 'type_identifier');
        const boundType =
          findChildByType(constraintNode, 'user_type') ??
          findChildByType(constraintNode, 'nullable_type');

        if (typeId && boundType) {
          // Find the matching type parameter and add this bound
          const matchingParam = typeParams.find((tp) => tp.name === typeId.text);
          if (matchingParam) {
            if (!matchingParam.bounds) {
              matchingParam.bounds = [];
            }
            matchingParam.bounds.push(boundType.text);
          }
        }
      }
    }
  }

  return typeParams;
}

function extractSingleTypeParameter(node: SyntaxNode): ParsedTypeParameter | undefined {
  // Structure: type_parameter > [modifiers] [type_identifier] [: type_constraint]
  const nameNode = findChildByType(node, 'type_identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;

  // Extract variance (in/out) and reified from modifiers
  let variance: 'in' | 'out' | undefined;
  let isReified = false;
  const modifiers = findChildByType(node, 'type_parameter_modifiers');
  if (modifiers) {
    for (const child of modifiers.children) {
      if (child.type === 'variance_modifier') {
        if (child.text === 'in') variance = 'in';
        if (child.text === 'out') variance = 'out';
      }
      if (child.type === 'reification_modifier' && child.text === 'reified') {
        isReified = true;
      }
    }
  }

  // Extract bounds (upper bounds after :)
  const bounds: string[] = [];
  const typeConstraint = findChildByType(node, 'type_constraint');
  if (typeConstraint) {
    // type_constraint contains the bound types
    for (const child of typeConstraint.children) {
      if (child.type === 'user_type' || child.type === 'nullable_type') {
        bounds.push(child.text);
      }
    }
  }

  // Also check for direct bounds (T : Comparable<T>)
  for (const child of node.children) {
    if (child.type === 'user_type' || child.type === 'nullable_type') {
      // Check if preceded by ':'
      const prev = child.previousSibling;
      if (prev?.type === ':') {
        bounds.push(child.text);
      }
    }
  }

  return {
    name,
    bounds: bounds.length > 0 ? bounds : undefined,
    variance,
    isReified: isReified || undefined,
  };
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

// =============================================================================
// Annotation Arguments (enhanced)
// =============================================================================

function extractAnnotationArguments(node: SyntaxNode): Record<string, string> | undefined {
  // Look for value_arguments in constructor_invocation
  const constructorInvocation = findChildByType(node, 'constructor_invocation');
  if (!constructorInvocation) return undefined;

  const valueArgs = findChildByType(constructorInvocation, 'value_arguments');
  if (!valueArgs) return undefined;

  const args: Record<string, string> = {};
  let positionalIndex = 0;

  for (const child of valueArgs.children) {
    if (child.type === 'value_argument') {
      const nameNode = findChildByType(child, 'simple_identifier');
      // Get the expression (everything after '=' or the whole argument)
      const expression = child.children.find(
        (c) =>
          c.type !== 'simple_identifier' &&
          c.type !== '=' &&
          c.type !== '(' &&
          c.type !== ')' &&
          c.type !== ','
      );

      if (nameNode) {
        // Named argument: @Deprecated(message = "use X")
        args[nameNode.text] = expression?.text ?? '';
      } else if (expression) {
        // Positional argument: @Deprecated("use X")
        args[`_${positionalIndex}`] = expression.text;
        positionalIndex++;
      }
    }
  }

  return Object.keys(args).length > 0 ? args : undefined;
}
