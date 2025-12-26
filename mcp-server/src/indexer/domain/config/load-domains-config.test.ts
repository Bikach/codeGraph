/**
 * Load Domains Config Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadDomainsConfig } from './load-domains-config.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const mockReadFile = vi.mocked(readFile);
const mockExistsSync = vi.mocked(existsSync);

describe('loadDomainsConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when no config file exists', async () => {
    const result = await loadDomainsConfig();

    expect(result).toEqual([]);
  });

  it('should load config from default path when present', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        domains: [
          {
            name: 'Payment',
            patterns: ['com.example.payment.*'],
          },
        ],
      })
    );

    const result = await loadDomainsConfig();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Payment');
  });

  it('should load config from custom path', async () => {
    mockExistsSync.mockImplementation((path) =>
      (path as string).includes('custom-config.json')
    );
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        domains: [
          {
            name: 'Custom',
            patterns: ['com.example.custom.*'],
          },
        ],
      })
    );

    const result = await loadDomainsConfig('custom-config.json');

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Custom');
  });

  it('should return empty array on invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('invalid json');

    const result = await loadDomainsConfig();

    expect(result).toEqual([]);
  });

  it('should return empty array when domains key is missing', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(JSON.stringify({}));

    const result = await loadDomainsConfig();

    expect(result).toEqual([]);
  });
});
