# Changelog

All notable changes to CodeGraph are documented here, newest first.
Versions follow [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-06-29

First tracked release. History prior to v2 is not retained.

### Added
- Embedded graph storage (LadybugDB): a single on-disk `.lbug` file — no server, no network hop, runs where the code lives.
- 10 MCP tools: `search_nodes`, `get_callers`, `get_callees`, `get_neighbors`, `get_implementations`, `get_impact`, `find_path`, `get_file_symbols`, `get_god_nodes`, `get_module_overview`.
- Analysis layer: system hotspots (god-nodes), project map (domains, cross-domain dependencies, cycles), seeded Louvain communities.
- Multi-language indexer: Kotlin, Java, TypeScript/JavaScript.

### Changed
- Storage moved from Neo4j to embedded LadybugDB; the server is read-only and opens per query, so re-indexing needs no restart.
- Output is deterministic and purely topological (no LLM, no embeddings).

### Fixed
- Resolver precision: homonymous free functions and types disambiguated, monorepo domain grouping, interface-method calls, local-variable type inference.
- Deterministic ordering for homonymous nodes.
- Vendored and minified files skipped at indexing.
