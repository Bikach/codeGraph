import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { DomainConfig, DomainsConfigFile } from '../types.js';

/**
 * Load domains configuration from file.
 */
export async function loadDomainsConfig(configPath?: string): Promise<DomainConfig[]> {
  const paths = configPath
    ? [configPath]
    : ['codegraph.domains.json', '.codegraph/domains.json', 'codegraph.config.json'];

  for (const path of paths) {
    const fullPath = join(process.cwd(), path);
    if (existsSync(fullPath)) {
      try {
        const content = await readFile(fullPath, 'utf-8');
        const config: DomainsConfigFile = JSON.parse(content);
        return config.domains || [];
      } catch {
        // Invalid JSON or structure, continue to next path

      }
    }
  }

  return [];
}
