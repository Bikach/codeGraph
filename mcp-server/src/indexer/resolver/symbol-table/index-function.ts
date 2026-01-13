/**
 * Index a function into the symbol table.
 */

import type { ParsedFunction, SupportedLanguage } from '../../types.js';
import type { FunctionSymbol, SymbolTable } from '../types.js';
import { addSymbol } from './add-symbol.js';

/**
 * Determine the default type for untyped parameters based on the language.
 * - Kotlin: 'Any'
 * - TypeScript/JavaScript: 'any'
 * - Java: 'Object'
 */
function getDefaultType(language: SupportedLanguage): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return 'any';
    case 'java':
      return 'Object';
    case 'kotlin':
    default:
      return 'Any';
  }
}

/**
 * Detect language from file extension.
 */
function detectLanguageFromPath(filePath: string): SupportedLanguage {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs'))
    return 'javascript';
  if (filePath.endsWith('.java')) return 'java';
  return 'kotlin'; // Default to Kotlin
}

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

  const language = detectLanguageFromPath(filePath);
  const defaultType = getDefaultType(language);

  const functionSymbol: FunctionSymbol = {
    name: func.name,
    fqn,
    kind: 'function',
    filePath,
    location: func.location,
    declaringTypeFqn,
    receiverType: func.receiverType,
    packageName,
    parameterTypes: func.parameters.map((p) => p.type || defaultType),
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
