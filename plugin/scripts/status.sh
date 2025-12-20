#!/bin/bash
# CodeGraph Status Script
# Shows Neo4j connection status and graph statistics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/../dist/status.js" "$@"
