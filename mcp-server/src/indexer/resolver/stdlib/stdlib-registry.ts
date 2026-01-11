/**
 * Standard Library Registry
 *
 * Central registry for language-specific stdlib providers.
 * Used by the resolver to get the appropriate stdlib for each file's language.
 */

import type { SupportedLanguage } from '../../types.js';
import type { StdlibProvider } from './stdlib-provider.js';
import { KotlinStdlibProvider } from './kotlin-stdlib.js';
import { JavaStdlibProvider } from './java-stdlib.js';
import { TypescriptStdlibProvider } from './typescript-stdlib.js';

/**
 * Registry of stdlib providers indexed by language.
 * For languages that share stdlibs (like Kotlin using Java stdlib),
 * we compose multiple providers.
 */
class StdlibRegistry {
  private providers = new Map<SupportedLanguage, StdlibProvider[]>();

  constructor() {
    // Initialize with built-in providers
    this.registerDefaults();
  }

  /**
   * Register default stdlib providers for supported languages.
   */
  private registerDefaults(): void {
    const kotlinProvider = new KotlinStdlibProvider();
    const javaProvider = new JavaStdlibProvider();
    const typescriptProvider = new TypescriptStdlibProvider();

    // Kotlin uses both Kotlin stdlib and Java stdlib (JVM interop)
    this.providers.set('kotlin', [kotlinProvider, javaProvider]);

    // Java uses only Java stdlib
    this.providers.set('java', [javaProvider]);

    // TypeScript and JavaScript share the same stdlib (ECMAScript + TypeScript types)
    this.providers.set('typescript', [typescriptProvider]);
    this.providers.set('javascript', [typescriptProvider]);
  }

  /**
   * Register a stdlib provider for specific languages.
   * @param provider - The stdlib provider to register
   */
  register(provider: StdlibProvider): void {
    for (const lang of provider.languages) {
      const existing = this.providers.get(lang) || [];
      existing.push(provider);
      this.providers.set(lang, existing);
    }
  }

  /**
   * Get all stdlib providers for a language.
   * Returns providers in order of priority (language-specific first, then shared).
   */
  getProviders(language: SupportedLanguage): StdlibProvider[] {
    return this.providers.get(language) || [];
  }

  /**
   * Get a composite provider that searches all providers for a language.
   * This is a convenience wrapper for the resolver.
   */
  getCompositeProvider(language: SupportedLanguage): CompositeStdlibProvider {
    const providers = this.getProviders(language);
    return new CompositeStdlibProvider(language, providers);
  }

  /**
   * Get the default wildcard imports for a language.
   * Combines all providers' default imports.
   */
  getDefaultWildcardImports(language: SupportedLanguage): string[] {
    const providers = this.getProviders(language);
    const imports = new Set<string>();

    for (const provider of providers) {
      for (const imp of provider.defaultWildcardImports) {
        imports.add(imp);
      }
    }

    return Array.from(imports);
  }
}

/**
 * Composite provider that searches multiple providers in order.
 * Used to combine language-specific and shared stdlib lookups.
 */
export class CompositeStdlibProvider implements StdlibProvider {
  readonly languages: readonly SupportedLanguage[];
  readonly defaultWildcardImports: readonly string[];

  constructor(
    language: SupportedLanguage,
    private providers: StdlibProvider[]
  ) {
    this.languages = [language];
    this.defaultWildcardImports = this.collectDefaultImports();
  }

  private collectDefaultImports(): string[] {
    const imports = new Set<string>();
    for (const provider of this.providers) {
      for (const imp of provider.defaultWildcardImports) {
        imports.add(imp);
      }
    }
    return Array.from(imports);
  }

  lookupFunction(name: string) {
    for (const provider of this.providers) {
      const result = provider.lookupFunction(name);
      if (result) return result;
    }
    return undefined;
  }

  lookupClass(name: string) {
    for (const provider of this.providers) {
      const result = provider.lookupClass(name);
      if (result) return result;
    }
    return undefined;
  }

  lookupStaticMethod(qualifiedName: string) {
    for (const provider of this.providers) {
      const result = provider.lookupStaticMethod(qualifiedName);
      if (result) return result;
    }
    return undefined;
  }

  isKnownSymbol(name: string): boolean {
    return this.providers.some((p) => p.isKnownSymbol(name));
  }

  getAllSymbols() {
    const result = new Map<string, import('../types.js').Symbol>();
    // Reverse order so earlier providers override later ones
    for (let i = this.providers.length - 1; i >= 0; i--) {
      const provider = this.providers[i];
      if (provider) {
        for (const [key, value] of provider.getAllSymbols()) {
          result.set(key, value);
        }
      }
    }
    return result;
  }
}

// Singleton instance
export const stdlibRegistry = new StdlibRegistry();

/**
 * Get stdlib provider for a specific language.
 * Convenience function that returns a composite provider.
 */
export function getStdlibProvider(language: SupportedLanguage): CompositeStdlibProvider {
  return stdlibRegistry.getCompositeProvider(language);
}

/**
 * Get default wildcard imports for a language.
 */
export function getDefaultWildcardImports(language: SupportedLanguage): string[] {
  return stdlibRegistry.getDefaultWildcardImports(language);
}
