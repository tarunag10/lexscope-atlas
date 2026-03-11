#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 scripts/sync_regulations.py --sources data/regulation_sources.json --output data/regulations.auto.json
