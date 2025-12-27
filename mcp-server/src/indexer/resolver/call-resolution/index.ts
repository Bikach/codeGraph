/**
 * Call Resolution Module
 *
 * This module handles resolving function/method calls to their target FQNs.
 * It supports various call patterns including:
 * - Qualified calls (com.example.Utils.parse())
 * - Constructor calls (User("John"))
 * - Method calls with receiver type
 * - Extension function calls
 * - Static/companion object calls
 */

export { resolveCall } from './resolve-call.js';
export { resolveConstructorCall } from './resolve-constructor-call.js';
export { resolveQualifiedCall } from './resolve-qualified-call.js';
export { resolveMethodInType } from './resolve-method-in-type.js';
export { resolveMethodInHierarchy } from './resolve-method-in-hierarchy.js';
export { resolveSymbolByName } from './resolve-symbol-by-name.js';
export { resolveExtensionFunction } from './resolve-extension-function.js';
export { resolveEnumStaticMethod } from './resolve-enum-static-method.js';
