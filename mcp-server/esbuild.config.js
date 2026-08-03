/**
 * esbuild configuration for bundling CodeGraph plugin.
 *
 * Bundles all scripts into single files for distribution.
 * Native modules (tree-sitter) are handled via external.
 */

import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin output directory: use CLAUDE_PLUGINS_ROOT env var or fallback to sibling repo
const pluginsRoot = process.env.CLAUDE_PLUGINS_ROOT || resolve(__dirname, '../../claude-plugins/codegraph');
const pluginDist = resolve(pluginsRoot, 'dist');

// Ensure output directory exists
if (!existsSync(pluginDist)) {
  mkdirSync(pluginDist, { recursive: true });
}

const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs', // CommonJS for compatibility
  sourcemap: false,
  minify: false,
  // Native modules cannot be bundled: they ship .node bindings and/or
  // platform-specific optionalDependencies, so they must resolve from
  // node_modules at runtime.
  external: [
    'tree-sitter',
    'tree-sitter-kotlin',
    'tree-sitter-java',
    'tree-sitter-typescript',
    '@ladybugdb/core',
  ],
};

async function build() {
  console.log('Building plugin bundles...');

  // 1. MCP Server
  await esbuild.build({
    ...commonOptions,
    entryPoints: ['src/index.ts'],
    outfile: resolve(pluginDist, 'mcp-server.js'),
  });
  console.log('  ✓ mcp-server.js');

  // 2. Index project script
  await esbuild.build({
    ...commonOptions,
    entryPoints: ['src/scripts/index-project.ts'],
    outfile: resolve(pluginDist, 'index-project.js'),
  });
  console.log('  ✓ index-project.js');

  // 3. Clear graph script
  await esbuild.build({
    ...commonOptions,
    entryPoints: ['src/scripts/clear-graph.ts'],
    outfile: resolve(pluginDist, 'clear-graph.js'),
  });
  console.log('  ✓ clear-graph.js');

  console.log('');
  console.log(`Done! Bundles written to ${pluginDist}`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
