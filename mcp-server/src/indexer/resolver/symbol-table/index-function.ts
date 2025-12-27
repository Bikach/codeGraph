/**
 * Index a function into the symbol table.
 */

import type { ParsedFunction } from '../../types.js';
import type { FunctionSymbol, SymbolTable } from '../types.js';
import { addSymbol } from './add-symbol.js';

/**
 * Index a function into the symbol table.
 */
export function indexFunction(
  table: SymbolTable,
  func: ParsedFunction,
  packageName: string,
  filePath: string,
  declaringTypeFqn?: string
): void {
  const fqn = declaringTypeFqn ? `${declaringTypeFqn}.${func.name}` : packageName ? `${packageName}.${func.name}` : func.name;

  const functionSymbol: FunctionSymbol = {
    name: func.name,
    fqn,
    kind: 'function',
    filePath,
    location: func.location,
    declaringTypeFqn,
    receiverType: func.receiverType,
    packageName,
    parameterTypes: func.parameters.map((p) => p.type || 'Any'),
    returnType: func.returnType,
    isExtension: func.isExtension,
    isOperator: func.isOperator,
    isInfix: func.isInfix,
    // Kotlin-specific metadata
    isSuspend: func.isSuspend || undefined,
    isInline: func.isInline || undefined,
  };

  addSymbol(table, functionSymbol);

  // Also add to function-specific index
  const existing = table.functionsByName.get(func.name) || [];
  existing.push(functionSymbol);
  table.functionsByName.set(func.name, existing);
}
