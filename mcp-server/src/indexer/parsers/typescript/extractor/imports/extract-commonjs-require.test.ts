import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractCommonJsRequires } from './extract-commonjs-require.js';

describe('extractCommonJsRequires', () => {
  describe('basic require', () => {
    it('should extract require with variable assignment', () => {
      const tree = parseTypeScript("const fs = require('fs');", '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('fs');
      expect(imports[0]!.name).toBe('fs');
    });

    it('should extract require from relative path', () => {
      const tree = parseTypeScript("const User = require('./User');", '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./User');
      expect(imports[0]!.name).toBe('User');
    });
  });

  describe('require without assignment', () => {
    it('should extract side-effect require', () => {
      const tree = parseTypeScript("require('./polyfill');", '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./polyfill');
      expect(imports[0]!.name).toBeUndefined();
    });
  });

  describe('multiple requires', () => {
    it('should extract multiple require statements', () => {
      const code = `
        const fs = require('fs');
        const path = require('path');
        const User = require('./User');
      `;
      const tree = parseTypeScript(code, '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toHaveLength(3);
      expect(imports[0]!.path).toBe('fs');
      expect(imports[1]!.path).toBe('path');
      expect(imports[2]!.path).toBe('./User');
    });
  });

  describe('nested require', () => {
    it('should extract require from function body', () => {
      const code = `
        function loadModule() {
          const mod = require('./module');
          return mod;
        }
      `;
      const tree = parseTypeScript(code, '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./module');
      expect(imports[0]!.name).toBe('mod');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for file without require', () => {
      const tree = parseTypeScript('const x = 1;', '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toEqual([]);
    });

    it('should ignore non-require function calls', () => {
      const tree = parseTypeScript("const result = someFunction('arg');", '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toEqual([]);
    });

    it('should handle empty file', () => {
      const tree = parseTypeScript('', '/test.js');
      const imports = extractCommonJsRequires(tree.rootNode);
      expect(imports).toEqual([]);
    });
  });
});
