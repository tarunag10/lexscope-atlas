# LexScope Atlas

Public app: [https://lexscope-atlas.vercel.app](https://lexscope-atlas.vercel.app)

## What this includes
- Global regulation triage UI
- Version-aware applicability logic (effective date + repeal window)
- Seed regulations in `data/regulations.seed.json`
- Optional auto-sourced regulation pack merged at runtime from `data/regulations.auto.json`

## Master baseline workflow
Use this repo as your long-term baseline branch and periodically refresh regulation packs.

### 1) Sync external/local regulation sources
```bash
./run_sync.sh
```

This runs:
- `scripts/sync_regulations.py`
- reads `data/regulation_sources.json`
- compiles unified output into `data/regulations.auto.json`

### 2) Run/deploy app
- Local static preview: open `index.html`
- Vercel deploy: `vercel --prod -y`

## Add more countries automatically later
Edit `data/regulation_sources.json` and add sources.

Supported source entries:
- `kind: "file"` (local JSON/CSV)
- `kind: "http"` (remote JSON/CSV URL)
- `format: "json" | "csv"`

Each source should produce LexScope regulation schema (or CSV columns used by import template).

## Key files
- App UI + logic: `index.html`
- Seed pack: `data/regulations.seed.json`
- Source registry: `data/regulation_sources.json`
- Example country source: `data/sources/india.fintech.json`
- Auto-compiled output: `data/regulations.auto.json`
- Sync script: `scripts/sync_regulations.py`

## Note
This tool is for regulatory triage, not legal advice.
