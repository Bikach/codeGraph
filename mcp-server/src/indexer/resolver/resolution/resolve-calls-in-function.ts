import type { ParsedFunction, ResolvedCall } from '../../types.js';
import type { SymbolTable, ResolutionContext } from '../types.js';
import { resolveCall } from '../call-resolution/index.js';

/**
 * Resolve calls within a function.
 */
export function resolveCallsInFunction(
  table: SymbolTable,
  context: ResolutionContext,
  func: ParsedFunction,
  funcFqn: string
): ResolvedCall[] {
  const resolvedCalls: ResolvedCall[] = [];

  // Create function-specific context with parameters as local variables
  const funcContext: ResolutionContext = {
    ...context,
    currentFunction: func,
    localVariables: new Map(context.localVariables),
  };

  // Add function parameters to local variables
  for (const param of func.parameters) {
    if (param.type) {
      funcContext.localVariables.set(param.name, param.type);
    }
  }

  // Resolve each call
  for (const call of func.calls) {
    const resolvedCallee = resolveCall(table, funcContext, call);
    if (resolvedCallee) {
      resolvedCalls.push({
        fromFqn: funcFqn,
        toFqn: resolvedCallee,
        location: call.location,
      });
    }
  }

  return resolvedCalls;
}
