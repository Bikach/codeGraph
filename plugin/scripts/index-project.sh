#!/bin/bash
# CodeGraph Index Script
# Indexes a source code project into Neo4j

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/../dist/index-project.js" "$@"
