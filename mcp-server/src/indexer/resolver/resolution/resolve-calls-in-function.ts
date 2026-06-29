import type { ParsedFunction, ResolvedCall, ParsedParameter } from '../../types.js';
import type { SymbolTable, ResolutionContext, PropertySymbol, FunctionSymbol } from '../types.js';
import { resolveCall } from '../call-resolution/index.js';
import { resolveSymbolByName } from '../call-resolution/resolve-symbol-by-name.js';
import { extractTypeNames } from '../../type-extraction.js';

/**
 * Expand an object-destructured parameter (`{ a, b }: Deps`) into per-binding local-variable types:
 * each binding `a` is mapped to the type of `Deps.a` (looked up via the symbol table). This lets calls
 * on the binding (`a.method()`) resolve through that type instead of falling back to by-name guessing.
 */
function expandDestructuredParam(
  table: SymbolTable,
  param: ParsedParameter,
  localVariables: Map<string, string>
): void {
  if (!param.type || !param.destructuredBindings?.length) return;
  // Resolve the container type to its FQN (TS FQN == simple name; fall back to a by-name lookup).
  const typeSymbol = (table.byName.get(param.type) ?? []).find(
    (s) => s.kind === 'class' || s.kind === 'interface' || s.kind === 'object'
  );
  const typeFqn = typeSymbol?.fqn ?? param.type;
  for (const binding of param.destructuredBindings) {
    const propSymbol = table.byFqn.get(`${typeFqn}.${binding}`);
    const propType = propSymbol?.kind === 'property' ? (propSymbol as PropertySymbol).type : undefined;
    if (propType) localVariables.set(binding, propType);
  }
}

/**
 * Reduce a (possibly generic) type string to the single meaningful inner type name the resolver can
 * look up: `Promise<JobOrder>` → `JobOrder`, `JobOrder[]` → `JobOrder`, `string` → undefined (builtin).
 * Reuses `extractTypeNames` (which already skips builtins and unwraps generics).
 */
function meaningfulTypeName(typeStr: string | undefined): string | undefined {
  return extractTypeNames(typeStr)[0];
}

/**
 * Seed local variables declared in the body (`const repo = makeRepo(); repo.find()`) into the context,
 * so subsequent calls on them resolve via the receiver's type (resolveCall step 2). Either the type is
 * known at parse-time (annotation / `new X()` / `as T`) or it is the RETURN type of a named call.
 */
function seedLocalVars(
  table: SymbolTable,
  context: ResolutionContext,
  func: ParsedFunction,
  localVariables: Map<string, string>
): void {
  for (const lv of func.localVars ?? []) {
    if (lv.type) {
      const type = meaningfulTypeName(lv.type);
      if (type) localVariables.set(lv.name, type);
    } else if (lv.initCall) {
      const symbol = resolveSymbolByName(table, context, lv.initCall.name);
      if (symbol?.kind !== 'function') continue;
      const type = meaningfulTypeName((symbol as FunctionSymbol).returnType);
      // Conservative: only seed when we get a concrete type — a missing edge beats a wrong one.
      if (type) localVariables.set(lv.name, type);
    }
  }
}

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

  // Add function parameters to local variables (expanding object-destructured deps params).
  for (const param of func.parameters) {
    if (param.destructuredBindings?.length) {
      expandDestructuredParam(table, param, funcContext.localVariables);
    } else if (param.type) {
      funcContext.localVariables.set(param.name, param.type);
    }
  }

  // Then add body-declared local variables (`const repo = makeRepo()`), whose type lets calls on them
  // resolve. Done AFTER params so a param of the same name keeps priority (shadowing is not modeled).
  seedLocalVars(table, funcContext, func, funcContext.localVariables);

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
