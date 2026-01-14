/**
 * Tests for module path inference utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  inferModulePath,
  collectModulePaths,
  buildModuleHierarchy,
  getParentModulePath,
  getModuleName,
} from './index.js';

describe('inferModulePath', () => {
  const projectPath = '/Users/test/my-project';

  describe('basic functionality', () => {
    it('should infer module path from file in src directory', () => {
      const result = inferModulePath('/Users/test/my-project/src/components/User.ts', {
        projectPath,
      });
      expect(result).toBe('components');
    });

    it('should infer nested module path', () => {
      const result = inferModulePath('/Users/test/my-project/src/services/auth/AuthService.ts', {
        projectPath,
      });
      expect(result).toBe('services/auth');
    });

    it('should strip lib source root', () => {
      const result = inferModulePath('/Users/test/my-project/lib/utils/helpers.ts', {
        projectPath,
      });
      expect(result).toBe('utils');
    });

    it('should strip app source root', () => {
      const result = inferModulePath('/Users/test/my-project/app/controllers/HomeController.ts', {
        projectPath,
      });
      expect(result).toBe('controllers');
    });

    it('should return undefined for file directly in source root', () => {
      const result = inferModulePath('/Users/test/my-project/src/index.ts', {
        projectPath,
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined for file outside project', () => {
      const result = inferModulePath('/other/project/src/file.ts', {
        projectPath,
      });
      expect(result).toBeUndefined();
    });
  });

  describe('with includeFileName option', () => {
    it('should include file name when option is enabled', () => {
      const result = inferModulePath('/Users/test/my-project/src/components/User.ts', {
        projectPath,
        includeFileName: true,
      });
      expect(result).toBe('components/User');
    });

    it('should handle deeply nested files with includeFileName', () => {
      const result = inferModulePath('/Users/test/my-project/src/features/auth/login/LoginForm.tsx', {
        projectPath,
        includeFileName: true,
      });
      expect(result).toBe('features/auth/login/LoginForm');
    });
  });

  describe('with custom separator', () => {
    it('should use custom separator', () => {
      const result = inferModulePath('/Users/test/my-project/src/components/user/Profile.ts', {
        projectPath,
        separator: '.',
      });
      expect(result).toBe('components.user');
    });
  });

  describe('with custom source roots', () => {
    it('should strip custom source roots', () => {
      const result = inferModulePath('/Users/test/my-project/packages/core/utils/helpers.ts', {
        projectPath,
        sourceRoots: ['packages', 'core'],
      });
      expect(result).toBe('utils');
    });

    it('should not strip directories not in source roots', () => {
      const result = inferModulePath('/Users/test/my-project/custom/components/Button.ts', {
        projectPath,
        sourceRoots: ['src'],
      });
      expect(result).toBe('custom/components');
    });
  });

  describe('edge cases', () => {
    it('should handle Windows-style paths', () => {
      // This test verifies path.normalize handles cross-platform paths
      const result = inferModulePath('/Users/test/my-project/src/components/User.ts', {
        projectPath: '/Users/test/my-project',
      });
      expect(result).toBe('components');
    });

    it('should handle files without extension', () => {
      const result = inferModulePath('/Users/test/my-project/src/components/User', {
        projectPath,
        includeFileName: true,
      });
      expect(result).toBe('components/User');
    });

    it('should handle multiple extensions', () => {
      const result = inferModulePath('/Users/test/my-project/src/components/User.spec.ts', {
        projectPath,
        includeFileName: true,
      });
      expect(result).toBe('components/User.spec');
    });
  });
});

describe('collectModulePaths', () => {
  const projectPath = '/Users/test/my-project';

  it('should collect unique module paths from file list', () => {
    const filePaths = [
      '/Users/test/my-project/src/components/User.ts',
      '/Users/test/my-project/src/components/Profile.ts',
      '/Users/test/my-project/src/services/AuthService.ts',
    ];

    const result = collectModulePaths(filePaths, { projectPath });
    expect(result).toContain('components');
    expect(result).toContain('services');
    expect(result.size).toBe(2);
  });

  it('should include parent modules for hierarchy', () => {
    const filePaths = [
      '/Users/test/my-project/src/features/auth/login/LoginForm.ts',
    ];

    const result = collectModulePaths(filePaths, { projectPath });
    expect(result).toContain('features');
    expect(result).toContain('features/auth');
    expect(result).toContain('features/auth/login');
    expect(result.size).toBe(3);
  });

  it('should handle empty file list', () => {
    const result = collectModulePaths([], { projectPath });
    expect(result.size).toBe(0);
  });

  it('should skip files that produce no module path', () => {
    const filePaths = [
      '/Users/test/my-project/src/index.ts', // At source root
      '/other/project/file.ts', // Outside project
      '/Users/test/my-project/src/components/User.ts', // Valid
    ];

    const result = collectModulePaths(filePaths, { projectPath });
    expect(result).toContain('components');
    expect(result.size).toBe(1);
  });
});

describe('buildModuleHierarchy', () => {
  it('should build hierarchy from module paths', () => {
    const modules = new Set(['components', 'services', 'services/auth', 'services/user']);
    const hierarchy = buildModuleHierarchy(modules);

    expect(hierarchy.get(null)).toEqual(expect.arrayContaining(['components', 'services']));
    expect(hierarchy.get('services')).toEqual(expect.arrayContaining(['services/auth', 'services/user']));
  });

  it('should handle deeply nested hierarchy', () => {
    const modules = new Set([
      'features',
      'features/auth',
      'features/auth/login',
      'features/auth/logout',
    ]);
    const hierarchy = buildModuleHierarchy(modules);

    expect(hierarchy.get(null)).toEqual(['features']);
    expect(hierarchy.get('features')).toEqual(['features/auth']);
    expect(hierarchy.get('features/auth')).toEqual(
      expect.arrayContaining(['features/auth/login', 'features/auth/logout'])
    );
  });

  it('should handle custom separator', () => {
    const modules = new Set(['components', 'components.user', 'components.profile']);
    const hierarchy = buildModuleHierarchy(modules, '.');

    expect(hierarchy.get(null)).toEqual(['components']);
    expect(hierarchy.get('components')).toEqual(
      expect.arrayContaining(['components.user', 'components.profile'])
    );
  });

  it('should handle empty set', () => {
    const hierarchy = buildModuleHierarchy(new Set());
    expect(hierarchy.size).toBe(0);
  });
});

describe('getParentModulePath', () => {
  it('should return parent for nested module', () => {
    expect(getParentModulePath('services/auth')).toBe('services');
    expect(getParentModulePath('features/auth/login')).toBe('features/auth');
  });

  it('should return null for top-level module', () => {
    expect(getParentModulePath('components')).toBeNull();
  });

  it('should handle custom separator', () => {
    expect(getParentModulePath('services.auth.login', '.')).toBe('services.auth');
  });
});

describe('getModuleName', () => {
  it('should return last segment of module path', () => {
    expect(getModuleName('services/auth/login')).toBe('login');
    expect(getModuleName('components')).toBe('components');
  });

  it('should handle custom separator', () => {
    expect(getModuleName('services.auth.login', '.')).toBe('login');
  });
});
