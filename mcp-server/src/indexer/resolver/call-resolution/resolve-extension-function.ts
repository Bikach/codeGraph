/**
 * Resolve an extension function call.
 * Supports overload resolution when multiple extension functions match.
 */

import type { SymbolTable, ResolutionContext } from '../types.js';
import type { ParsedCall } from '../../types.js';
import { selectBestOverload, isTypeCompatible } from '../overload-resolution/index.js';

/**
 * Resolve an extension function call.
 * Supports overload resolution when multiple extension functions match.
 *
 * @param table - The symbol table to search in
 * @param context - The resolution context
 * @param receiver - The receiver expression name
 * @param functionName - The name of the extension function
 * @param call - Optional call info for overload resolution
 * @returns The resolved extension function FQN, or undefined if not found
 */
export function resolveExtensionFunction(
  table: SymbolTable,
  context: ResolutionContext,
  receiver: string,
  functionName: string,
  call?: ParsedCall
): string | undefined {
  // Get all functions with this name
  const allCandidates = table.functionsByName.get(functionName);
  if (!allCandidates || allCandidates.length === 0) return undefined;

  // Filter to extension functions
  const extensionFuncs = allCandidates.filter((f) => f.isExtension);
  if (extensionFuncs.length === 0) return undefined;

  // Try to determine receiver type
  let receiverType: string | undefined;

  // Check local variables
  receiverType = context.localVariables.get(receiver);

  // Check class properties
  if (!receiverType && context.currentClass) {
    const prop = context.currentClass.properties.find((p) => p.name === receiver);
    receiverType = prop?.type;
  }

  // Filter by receiver type if known
  let matchingExtensions = extensionFuncs;
  if (receiverType) {
    const baseReceiverType = receiverType.split('<')[0]?.trim() ?? receiverType;
    matchingExtensions = extensionFuncs.filter((ext) => {
      if (!ext.receiverType) return false;
      const extReceiverBase = ext.receiverType.split('<')[0]?.trim() ?? ext.receiverType;
      return extReceiverBase === baseReceiverType || extReceiverBase === receiverType;
    });

    // If no exact match, try type compatibility
    if (matchingExtensions.length === 0) {
      matchingExtensions = extensionFuncs.filter((ext) => {
        if (!ext.receiverType) return false;
        const extReceiverBase = ext.receiverType.split('<')[0]?.trim() ?? ext.receiverType;
        return isTypeCompatible(baseReceiverType, extReceiverBase);
      });
    }
  }

  // If still no matches, fall back to all extension functions
  if (matchingExtensions.length === 0) {
    matchingExtensions = extensionFuncs;
  }

  // Use overload resolution if multiple candidates
  if (matchingExtensions.length === 1 && matchingExtensions[0]) {
    return matchingExtensions[0].fqn;
  }

  const best = selectBestOverload(matchingExtensions, call);
  return best?.fqn;
}
