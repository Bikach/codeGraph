import type { ParsedFile, ResolvedCall, ResolvedFile } from '../../types.js';
import type { SymbolTable } from '../types.js';
import { createResolutionContext } from './create-resolution-context.js';
import { resolveCallsInFunction } from './resolve-calls-in-function.js';
import { resolveCallsInClass } from './resolve-calls-in-class.js';

/**
 * Resolve symbols in a single file.
 */
export function resolveFile(table: SymbolTable, file: ParsedFile): ResolvedFile {
  const context = createResolutionContext(file);
  const resolvedCalls: ResolvedCall[] = [];
  const packageName = file.packageName || '';

  // Resolve calls in top-level functions
  for (const func of file.topLevelFunctions) {
    const funcFqn = packageName ? `${packageName}.${func.name}` : func.name;
    resolvedCalls.push(...resolveCallsInFunction(table, context, func, funcFqn));
  }

  // Resolve calls in classes
  for (const cls of file.classes) {
    resolvedCalls.push(...resolveCallsInClass(table, context, cls, packageName));
  }

  // Resolve calls in object expressions (anonymous objects)
  for (const objExpr of file.objectExpressions) {
    const anonymousFqn = packageName
      ? `${packageName}.<anonymous>@${objExpr.location.startLine}`
      : `<anonymous>@${objExpr.location.startLine}`;

    for (const func of objExpr.functions) {
      const funcFqn = `${anonymousFqn}.${func.name}`;
      resolvedCalls.push(...resolveCallsInFunction(table, context, func, funcFqn));
    }
  }

  return {
    ...file,
    resolvedCalls,
  };
}
