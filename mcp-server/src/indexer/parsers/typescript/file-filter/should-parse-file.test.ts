import { describe, it, expect } from 'vitest';
import { shouldParseFile } from './should-parse-file.js';

describe('shouldParseFile', () => {
  describe('excluded directories', () => {
    it('should exclude node_modules', () => {
      expect(shouldParseFile('/project/node_modules/lodash/index.js')).toBe(false);
      expect(shouldParseFile('/project/node_modules/@types/node/index.d.ts')).toBe(false);
      expect(shouldParseFile('node_modules/express/lib/router.js')).toBe(false);
    });

    it('should exclude dist folder', () => {
      expect(shouldParseFile('/project/dist/index.js')).toBe(false);
      expect(shouldParseFile('/project/dist/bundle.js')).toBe(false);
    });

    it('should exclude build folder', () => {
      expect(shouldParseFile('/project/build/index.js')).toBe(false);
      expect(shouldParseFile('/project/build/static/main.js')).toBe(false);
    });

    it('should exclude .next folder', () => {
      expect(shouldParseFile('/project/.next/server/pages/index.js')).toBe(false);
    });

    it('should exclude .nuxt folder', () => {
      expect(shouldParseFile('/project/.nuxt/components/index.js')).toBe(false);
    });

    it('should exclude coverage folder', () => {
      expect(shouldParseFile('/project/coverage/lcov-report/index.js')).toBe(false);
    });

    it('should exclude .git folder', () => {
      expect(shouldParseFile('/project/.git/hooks/pre-commit')).toBe(false);
    });

    it('should handle Windows-style paths', () => {
      expect(shouldParseFile('C:\\project\\node_modules\\lodash\\index.js')).toBe(false);
      expect(shouldParseFile('C:\\project\\dist\\bundle.js')).toBe(false);
    });
  });

  describe('config files', () => {
    it('should exclude webpack.config.js', () => {
      expect(shouldParseFile('/project/webpack.config.js')).toBe(false);
    });

    it('should exclude vite.config.ts', () => {
      expect(shouldParseFile('/project/vite.config.ts')).toBe(false);
    });

    it('should exclude jest.config.js', () => {
      expect(shouldParseFile('/project/jest.config.js')).toBe(false);
    });

    it('should exclude vitest.config.ts', () => {
      expect(shouldParseFile('/project/vitest.config.ts')).toBe(false);
    });

    it('should exclude tailwind.config.js', () => {
      expect(shouldParseFile('/project/tailwind.config.js')).toBe(false);
    });

    it('should exclude next.config.js', () => {
      expect(shouldParseFile('/project/next.config.js')).toBe(false);
      expect(shouldParseFile('/project/next.config.mjs')).toBe(false);
    });

    it('should exclude eslint config files', () => {
      expect(shouldParseFile('/project/.eslintrc.js')).toBe(false);
      expect(shouldParseFile('/project/eslint.config.js')).toBe(false);
      expect(shouldParseFile('/project/eslint.config.mjs')).toBe(false);
    });

    it('should exclude prettier config files', () => {
      expect(shouldParseFile('/project/prettier.config.js')).toBe(false);
      expect(shouldParseFile('/project/.prettierrc.js')).toBe(false);
    });

    it('should exclude babel config files', () => {
      expect(shouldParseFile('/project/babel.config.js')).toBe(false);
      expect(shouldParseFile('/project/.babelrc.js')).toBe(false);
    });

    it('should exclude setup files', () => {
      expect(shouldParseFile('/project/jest.setup.ts')).toBe(false);
      expect(shouldParseFile('/project/vitest.setup.js')).toBe(false);
    });

    it('should exclude package files', () => {
      expect(shouldParseFile('/project/package.json')).toBe(false);
      expect(shouldParseFile('/project/package-lock.json')).toBe(false);
    });

    it('should exclude tsconfig.json', () => {
      expect(shouldParseFile('/project/tsconfig.json')).toBe(false);
    });
  });

  describe('generated files', () => {
    it('should exclude .d.ts declaration files by default', () => {
      expect(shouldParseFile('/project/src/types.d.ts')).toBe(false);
      expect(shouldParseFile('/project/types/global.d.ts')).toBe(false);
    });

    it('should include .d.ts files when option is enabled', () => {
      expect(shouldParseFile('/project/src/types.d.ts', { includeDeclarationFiles: true })).toBe(true);
    });

    it('should exclude minified files', () => {
      expect(shouldParseFile('/project/dist/app.min.js')).toBe(false);
      expect(shouldParseFile('/project/vendor/jquery.min.js')).toBe(false);
    });

    it('should exclude bundle files', () => {
      expect(shouldParseFile('/project/dist/main.bundle.js')).toBe(false);
    });

    it('should exclude chunk files', () => {
      expect(shouldParseFile('/project/dist/0.chunk.js')).toBe(false);
    });

    it('should exclude explicitly generated files', () => {
      expect(shouldParseFile('/project/src/api.generated.ts')).toBe(false);
      expect(shouldParseFile('/project/src/schema.generated.js')).toBe(false);
    });
  });

  describe('source files', () => {
    it('should include TypeScript source files', () => {
      expect(shouldParseFile('/project/src/index.ts')).toBe(true);
      expect(shouldParseFile('/project/src/components/Button.tsx')).toBe(true);
    });

    it('should include JavaScript source files', () => {
      expect(shouldParseFile('/project/src/index.js')).toBe(true);
      expect(shouldParseFile('/project/src/components/Button.jsx')).toBe(true);
    });

    it('should include ES modules', () => {
      expect(shouldParseFile('/project/src/utils.mjs')).toBe(true);
    });

    it('should include CommonJS modules', () => {
      expect(shouldParseFile('/project/src/utils.cjs')).toBe(true);
    });

    it('should include files in src directory', () => {
      expect(shouldParseFile('/project/src/services/user-service.ts')).toBe(true);
    });

    it('should include files in lib directory', () => {
      expect(shouldParseFile('/project/lib/utils/helpers.ts')).toBe(true);
    });

    it('should include files in app directory', () => {
      expect(shouldParseFile('/project/app/page.tsx')).toBe(true);
    });
  });

  describe('test files', () => {
    it('should include test files by default', () => {
      expect(shouldParseFile('/project/src/utils.test.ts')).toBe(true);
      expect(shouldParseFile('/project/src/utils.spec.ts')).toBe(true);
    });

    it('should exclude test files when option is set to false', () => {
      expect(shouldParseFile('/project/src/utils.test.ts', { includeTestFiles: false })).toBe(false);
      expect(shouldParseFile('/project/src/utils.spec.ts', { includeTestFiles: false })).toBe(false);
    });

    it('should exclude __tests__ directory when option is set to false', () => {
      expect(shouldParseFile('/project/src/__tests__/utils.ts', { includeTestFiles: false })).toBe(false);
    });

    it('should exclude test directory when option is set to false', () => {
      expect(shouldParseFile('/project/test/utils.ts', { includeTestFiles: false })).toBe(false);
      expect(shouldParseFile('/project/tests/utils.ts', { includeTestFiles: false })).toBe(false);
    });
  });

  describe('custom options', () => {
    it('should exclude additional directories', () => {
      expect(shouldParseFile('/project/vendor/lib.js', { additionalExcludedDirs: ['vendor'] })).toBe(false);
      expect(shouldParseFile('/project/generated/api.ts', { additionalExcludedDirs: ['generated'] })).toBe(false);
    });

    it('should exclude additional patterns', () => {
      expect(shouldParseFile('/project/src/temp_file.ts', { additionalExcludedPatterns: [/temp_/] })).toBe(false);
    });

    it('should combine multiple exclusion options', () => {
      const options = {
        additionalExcludedDirs: ['vendor'],
        additionalExcludedPatterns: [/_backup\./],
        includeTestFiles: false,
      };
      expect(shouldParseFile('/project/vendor/lib.js', options)).toBe(false);
      expect(shouldParseFile('/project/src/file_backup.ts', options)).toBe(false);
      expect(shouldParseFile('/project/src/utils.test.ts', options)).toBe(false);
      expect(shouldParseFile('/project/src/index.ts', options)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle path starting with excluded directory name', () => {
      expect(shouldParseFile('node_modules/express/index.js')).toBe(false);
      expect(shouldParseFile('dist/bundle.js')).toBe(false);
    });

    it('should not exclude directory substrings in filenames', () => {
      expect(shouldParseFile('/project/src/distribution.ts')).toBe(true);
      expect(shouldParseFile('/project/src/build-utils.ts')).toBe(true);
      expect(shouldParseFile('/project/src/modules/node-manager.ts')).toBe(true);
    });

    it('should handle deeply nested paths', () => {
      expect(shouldParseFile('/project/packages/core/src/lib/utils/helpers.ts')).toBe(true);
      expect(shouldParseFile('/project/packages/core/node_modules/lodash/index.js')).toBe(false);
    });

    it('should handle paths with special characters', () => {
      expect(shouldParseFile('/project/src/my-component.tsx')).toBe(true);
      expect(shouldParseFile('/project/src/my_component.tsx')).toBe(true);
    });
  });
});
