#!/bin/bash
# CodeGraph Setup Script
# Starts Neo4j and prepares the database

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/../dist/setup.js" "$@"
