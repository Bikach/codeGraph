import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractDynamicImports } from './extract-dynamic-import.js';

describe('extractDynamicImports', () => {
  describe('basic dynamic imports', () => {
    it('should extract basic dynamic import with string literal', () => {
      const tree = parseTypeScript("const module = import('./module');", '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./module');
      expect(imports[0]!.isDynamic).toBe(true);
    });

    it('should extract dynamic import with double quotes', () => {
      const tree = parseTypeScript('const module = import("./module");', '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./module');
      expect(imports[0]!.isDynamic).toBe(true);
    });

    it('should extract dynamic import from npm package', () => {
      const tree = parseTypeScript("const lodash = import('lodash');", '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('lodash');
      expect(imports[0]!.isDynamic).toBe(true);
    });
  });

  describe('await dynamic imports', () => {
    it('should extract await dynamic import', () => {
      const code = `
        async function load() {
          const module = await import('./lazy');
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./lazy');
      expect(imports[0]!.isDynamic).toBe(true);
    });

    it('should extract await dynamic import with destructuring', () => {
      const code = `
        async function load() {
          const { foo, bar } = await import('./utils');
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./utils');
      expect(imports[0]!.isDynamic).toBe(true);
    });
  });

  describe('chained dynamic imports', () => {
    it('should extract dynamic import with .then() chain', () => {
      const code = "import('./lazy').then(m => m.default);";
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./lazy');
      expect(imports[0]!.isDynamic).toBe(true);
    });

    it('should extract dynamic import with multiple .then() chains', () => {
      const code = "import('./module').then(m => m.init()).then(result => result);";
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./module');
    });
  });

  describe('template literal dynamic imports', () => {
    it('should extract dynamic import with template literal', () => {
      const code = 'const module = import(`./dynamic/${name}`);';
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('`./dynamic/${name}`');
      expect(imports[0]!.isDynamic).toBe(true);
      expect(imports[0]!.isTemplateLiteral).toBe(true);
    });

    it('should extract dynamic import with simple template literal', () => {
      const code = 'const module = import(`./module`);';
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('`./module`');
      expect(imports[0]!.isDynamic).toBe(true);
      expect(imports[0]!.isTemplateLiteral).toBe(true);
    });

    it('should not mark string literal as template literal', () => {
      const code = "const module = import('./module');";
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.isTemplateLiteral).toBeUndefined();
    });
  });

  describe('multiple dynamic imports', () => {
    it('should extract multiple dynamic imports in the same file', () => {
      const code = `
        async function loadModules() {
          const module1 = await import('./module1');
          const module2 = await import('./module2');
          const module3 = await import('./module3');
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(3);
      expect(imports[0]!.path).toBe('./module1');
      expect(imports[1]!.path).toBe('./module2');
      expect(imports[2]!.path).toBe('./module3');
    });

    it('should extract dynamic imports in conditional expressions', () => {
      const code = `
        const module = condition
          ? await import('./moduleA')
          : await import('./moduleB');
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(2);
      expect(imports.map((i) => i.path)).toContain('./moduleA');
      expect(imports.map((i) => i.path)).toContain('./moduleB');
    });
  });

  describe('nested dynamic imports', () => {
    it('should extract dynamic import inside a function', () => {
      const code = `
        function lazyLoad() {
          return import('./lazy-component');
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./lazy-component');
    });

    it('should extract dynamic import inside an arrow function', () => {
      const code = `
        const lazyLoad = () => import('./lazy-component');
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./lazy-component');
    });

    it('should extract dynamic import inside a class method', () => {
      const code = `
        class Loader {
          async load() {
            return await import('./module');
          }
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./module');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for file without dynamic imports', () => {
      const code = `
        import React from 'react';
        const x = 1;
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toEqual([]);
    });

    it('should return empty array for empty file', () => {
      const tree = parseTypeScript('', '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toEqual([]);
    });

    it('should not confuse regular function call with import', () => {
      const code = `
        const importModule = () => {};
        importModule('./module');
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toEqual([]);
    });
  });

  describe('real-world patterns', () => {
    it('should handle React lazy loading pattern', () => {
      const code = `
        const LazyComponent = React.lazy(() => import('./LazyComponent'));
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./LazyComponent');
    });

    it('should handle dynamic import in switch case', () => {
      const code = `
        async function loadModule(type: string) {
          switch (type) {
            case 'a':
              return import('./moduleA');
            case 'b':
              return import('./moduleB');
            default:
              return import('./defaultModule');
          }
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(3);
      expect(imports.map((i) => i.path)).toEqual(['./moduleA', './moduleB', './defaultModule']);
    });

    it('should handle dynamic import in try-catch', () => {
      const code = `
        async function loadModule() {
          try {
            return await import('./module');
          } catch (error) {
            return await import('./fallback');
          }
        }
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractDynamicImports(tree.rootNode);
      expect(imports).toHaveLength(2);
      expect(imports.map((i) => i.path)).toContain('./module');
      expect(imports.map((i) => i.path)).toContain('./fallback');
    });
  });
});
