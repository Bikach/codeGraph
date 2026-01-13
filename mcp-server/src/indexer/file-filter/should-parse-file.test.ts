import { describe, it, expect } from 'vitest';
import {
  shouldParseFile,
  shouldScanDirectory,
  isTestFile,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_CONFIG_FILES,
} from './should-parse-file.js';

describe('shouldScanDirectory', () => {
  describe('excluded directories', () => {
    it('should exclude node_modules', () => {
      expect(shouldScanDirectory('node_modules')).toBe(false);
    });

    it('should exclude .git', () => {
      expect(shouldScanDirectory('.git')).toBe(false);
    });

    it('should exclude build directories', () => {
      expect(shouldScanDirectory('dist')).toBe(false);
      expect(shouldScanDirectory('build')).toBe(false);
      expect(shouldScanDirectory('out')).toBe(false);
      expect(shouldScanDirectory('target')).toBe(false);
    });

    it('should exclude framework cache directories', () => {
      expect(shouldScanDirectory('.next')).toBe(false);
      expect(shouldScanDirectory('.nuxt')).toBe(false);
      expect(shouldScanDirectory('.angular')).toBe(false);
      expect(shouldScanDirectory('.turbo')).toBe(false);
      expect(shouldScanDirectory('.vercel')).toBe(false);
    });

    it('should exclude iOS build directories', () => {
      expect(shouldScanDirectory('DerivedData')).toBe(false);
      expect(shouldScanDirectory('Pods')).toBe(false);
    });

    it('should exclude Android build directories', () => {
      expect(shouldScanDirectory('.gradle')).toBe(false);
    });

    it('should exclude IDE directories', () => {
      expect(shouldScanDirectory('.idea')).toBe(false);
      expect(shouldScanDirectory('.vscode')).toBe(false);
    });
  });

  describe('allowed directories', () => {
    it('should allow src directory', () => {
      expect(shouldScanDirectory('src')).toBe(true);
    });

    it('should allow lib directory', () => {
      expect(shouldScanDirectory('lib')).toBe(true);
    });

    it('should allow app directory', () => {
      expect(shouldScanDirectory('app')).toBe(true);
    });

    it('should allow components directory', () => {
      expect(shouldScanDirectory('components')).toBe(true);
    });
  });

  describe('additional excluded dirs option', () => {
    it('should exclude additional directories', () => {
      expect(shouldScanDirectory('custom', { additionalExcludedDirs: ['custom'] })).toBe(false);
    });

    it('should still exclude default directories', () => {
      expect(shouldScanDirectory('node_modules', { additionalExcludedDirs: ['custom'] })).toBe(
        false
      );
    });
  });

  describe('path-based exclusions', () => {
    it('should exclude public directory inside ios/', () => {
      expect(shouldScanDirectory('public', {}, '/project/ios/App/App/public')).toBe(false);
    });

    it('should exclude public directory inside android/', () => {
      expect(shouldScanDirectory('public', {}, '/project/android/app/src/main/assets/public')).toBe(
        false
      );
    });

    it('should allow public directory outside ios/android', () => {
      expect(shouldScanDirectory('public', {}, '/project/src/public')).toBe(false); // Still excluded by name
    });

    it('should exclude directories inside .angular/', () => {
      expect(shouldScanDirectory('cache', {}, '/project/.angular/cache')).toBe(false);
    });

    it('should allow cache directory outside .angular', () => {
      expect(shouldScanDirectory('mycache', {}, '/project/src/mycache')).toBe(true);
    });
  });
});

describe('shouldParseFile', () => {
  describe('excluded directories in path', () => {
    it('should exclude files in node_modules', () => {
      expect(shouldParseFile('/project/node_modules/lodash/index.js')).toBe(false);
    });

    it('should exclude files in DerivedData', () => {
      expect(shouldParseFile('/project/ios/DerivedData/Build/main.js')).toBe(false);
    });

    it('should exclude files in .angular cache', () => {
      expect(shouldParseFile('/project/.angular/cache/component.ts')).toBe(false);
    });

    it('should exclude files in .next', () => {
      expect(shouldParseFile('/project/.next/server/app.js')).toBe(false);
    });

    it('should exclude files in Pods', () => {
      expect(shouldParseFile('/project/ios/Pods/AFNetworking/AFNetworking.m')).toBe(false);
    });
  });

  describe('allowed source files', () => {
    it('should allow files in src directory', () => {
      expect(shouldParseFile('/project/src/index.ts')).toBe(true);
    });

    it('should allow files in app directory', () => {
      expect(shouldParseFile('/project/app/component.tsx')).toBe(true);
    });

    it('should allow TypeScript files', () => {
      expect(shouldParseFile('/project/src/utils.ts')).toBe(true);
    });

    it('should allow JavaScript files', () => {
      expect(shouldParseFile('/project/src/helper.js')).toBe(true);
    });
  });

  describe('config file exclusion', () => {
    it('should exclude webpack.config.js by default', () => {
      expect(shouldParseFile('/project/webpack.config.js')).toBe(false);
    });

    it('should exclude vite.config.ts by default', () => {
      expect(shouldParseFile('/project/vite.config.ts')).toBe(false);
    });

    it('should exclude jest.config.js by default', () => {
      expect(shouldParseFile('/project/jest.config.js')).toBe(false);
    });

    it('should exclude eslint config files', () => {
      expect(shouldParseFile('/project/.eslintrc.js')).toBe(false);
      expect(shouldParseFile('/project/eslint.config.mjs')).toBe(false);
    });

    it('should include config files when option is set', () => {
      expect(shouldParseFile('/project/webpack.config.js', { includeConfigFiles: true })).toBe(
        true
      );
    });
  });

  describe('generated file exclusion', () => {
    it('should exclude .d.ts files by default', () => {
      expect(shouldParseFile('/project/types.d.ts')).toBe(false);
    });

    it('should exclude .min.js files', () => {
      expect(shouldParseFile('/project/lib.min.js')).toBe(false);
    });

    it('should exclude .bundle.js files', () => {
      expect(shouldParseFile('/project/app.bundle.js')).toBe(false);
    });

    it('should include .d.ts files when option is set', () => {
      expect(shouldParseFile('/project/types.d.ts', { includeDeclarationFiles: true })).toBe(true);
    });
  });

  describe('test file handling', () => {
    it('should include test files by default', () => {
      expect(shouldParseFile('/project/src/utils.test.ts')).toBe(true);
    });

    it('should exclude test files when option is set', () => {
      expect(shouldParseFile('/project/src/utils.test.ts', { includeTestFiles: false })).toBe(
        false
      );
      expect(shouldParseFile('/project/src/utils.spec.ts', { includeTestFiles: false })).toBe(
        false
      );
    });

    it('should exclude files in __tests__ directory when option is set', () => {
      expect(
        shouldParseFile('/project/src/__tests__/utils.ts', { includeTestFiles: false })
      ).toBe(false);
    });
  });
});

describe('isTestFile', () => {
  describe('test file patterns', () => {
    it('should identify .test.ts files', () => {
      expect(isTestFile('/project/src/utils.test.ts')).toBe(true);
    });

    it('should identify .spec.ts files', () => {
      expect(isTestFile('/project/src/utils.spec.ts')).toBe(true);
    });

    it('should identify files in __tests__ directory', () => {
      expect(isTestFile('/project/src/__tests__/utils.ts')).toBe(true);
    });

    it('should identify files in test directory', () => {
      expect(isTestFile('/project/test/utils.ts')).toBe(true);
    });

    it('should identify Kotlin test files', () => {
      expect(isTestFile('/project/src/UserServiceTest.kt')).toBe(true);
    });

    it('should identify Android test files', () => {
      expect(isTestFile('/project/app/src/androidTest/java/Test.java')).toBe(true);
    });
  });

  describe('non-test files', () => {
    it('should not identify regular source files', () => {
      expect(isTestFile('/project/src/utils.ts')).toBe(false);
    });

    it('should not identify index files', () => {
      expect(isTestFile('/project/src/index.ts')).toBe(false);
    });
  });
});

describe('EXCLUDED_DIRECTORIES constant', () => {
  it('should include common build directories', () => {
    expect(EXCLUDED_DIRECTORIES).toContain('dist');
    expect(EXCLUDED_DIRECTORIES).toContain('build');
    expect(EXCLUDED_DIRECTORIES).toContain('out');
    expect(EXCLUDED_DIRECTORIES).toContain('target');
  });

  it('should include framework directories', () => {
    expect(EXCLUDED_DIRECTORIES).toContain('.next');
    expect(EXCLUDED_DIRECTORIES).toContain('.nuxt');
    expect(EXCLUDED_DIRECTORIES).toContain('.angular');
  });

  it('should include mobile platform directories', () => {
    expect(EXCLUDED_DIRECTORIES).toContain('DerivedData');
    expect(EXCLUDED_DIRECTORIES).toContain('Pods');
    expect(EXCLUDED_DIRECTORIES).toContain('.gradle');
  });
});

describe('EXCLUDED_CONFIG_FILES constant', () => {
  it('should include common config files', () => {
    expect(EXCLUDED_CONFIG_FILES).toContain('webpack.config.js');
    expect(EXCLUDED_CONFIG_FILES).toContain('vite.config.ts');
    expect(EXCLUDED_CONFIG_FILES).toContain('jest.config.js');
  });

  it('should include package manager files', () => {
    expect(EXCLUDED_CONFIG_FILES).toContain('package.json');
    expect(EXCLUDED_CONFIG_FILES).toContain('yarn.lock');
  });

  it('should include mobile config files', () => {
    expect(EXCLUDED_CONFIG_FILES).toContain('Podfile');
    expect(EXCLUDED_CONFIG_FILES).toContain('build.gradle');
  });
});
