#!/usr/bin/env bash
set -euo pipefail

# Format all code files in the Mosaic project
# Runs cargo fmt for Rust and bun format for TypeScript/JavaScript

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}Formatting Mosaic project files...${NC}"

# [1/2] Format Rust code (server)
echo -e "\n${YELLOW}[1/2] Formatting Rust code (server)...${NC}"
if [ -f server/Cargo.toml ]; then
  (cd server && cargo fmt) && echo -e "  ${GREEN}server: OK${NC}" || echo -e "  ${RED}server: FAILED${NC}"
else
  echo -e "  ${GRAY}server: skipped (not found)${NC}"
fi

# [2/2] Format TypeScript/JavaScript packages via turbo
echo -e "\n${YELLOW}[2/2] Formatting TypeScript packages...${NC}"
bun run format

echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}All formatting complete!${NC}"
echo -e "${CYAN}========================================${NC}"
