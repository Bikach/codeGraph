import type { ParsedClass, ResolvedCall } from '../../types.js';
import type { SymbolTable, ResolutionContext } from '../types.js';
import { resolveCallsInFunction } from './resolve-calls-in-function.js';

/**
 * Resolve calls in a class and its members.
 */
export function resolveCallsInClass(
  table: SymbolTable,
  context: ResolutionContext,
  cls: ParsedClass,
  packageName: string,
  parentFqn?: string
): ResolvedCall[] {
  const classFqn = parentFqn
    ? `${parentFqn}.${cls.name}`
    : packageName
      ? `${packageName}.${cls.name}`
      : cls.name;

  const resolvedCalls: ResolvedCall[] = [];

  // Update context for this class
  const classContext: ResolutionContext = {
    ...context,
    currentClass: cls,
  };

  // Resolve calls in functions
  for (const func of cls.functions) {
    const funcFqn = `${classFqn}.${func.name}`;
    resolvedCalls.push(...resolveCallsInFunction(table, classContext, func, funcFqn));
  }

  // Resolve calls in nested classes
  for (const nested of cls.nestedClasses) {
    resolvedCalls.push(...resolveCallsInClass(table, context, nested, packageName, classFqn));
  }

  // Resolve calls in companion object
  if (cls.companionObject) {
    const companionFqn = `${classFqn}.Companion`;
    for (const func of cls.companionObject.functions) {
      const funcFqn = `${companionFqn}.${func.name}`;
      resolvedCalls.push(...resolveCallsInFunction(table, classContext, func, funcFqn));
    }
  }

  return resolvedCalls;
}
