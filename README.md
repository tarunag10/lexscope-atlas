# LexScope Global (v2)

LexScope Global is a backend-driven regulatory applicability checker with a scalable regulation registry.

## What is implemented
- Versioned regulation model (`regulations` + `regulation_versions`)
- Effective-date evaluation (`as_of_date`) with repeal history support
- Admin import API/UI for JSON and CSV
- Expanded country pack: EU, UK, US, Singapore, UAE, India, Canada, Australia, Japan, Brazil, Saudi Arabia
- Seeded catalog with historical and active versions

## Run
From project root:

```bash
./run.sh
```

Then open:

[http://127.0.0.1:8080](http://127.0.0.1:8080)

## Core files
- Backend server and evaluator: `backend/server.py`
- Frontend UI (evaluation + admin import): `frontend/index.html`
- Seed data: `data/regulations.seed.json`
- CSV template: `data/regulations.import.template.csv`
- SQLite DB (auto-created): `data/regulations.db`

## API
- `GET /api/meta`
  - Returns options, today date, active regulation count
- `GET /api/regulations`
  - Returns active regulation versions for current date
- `POST /api/check`
  - Evaluates profile against active versions as of `as_of_date`
- `POST /api/admin/import`
  - Imports/upserts regulations and versions from JSON/CSV

## Check request example

```bash
curl -X POST http://127.0.0.1:8080/api/check \
  -H 'Content-Type: application/json' \
  -d '{
    "jurisdiction": "EU",
    "industry": "TECHNOLOGY",
    "company_size": "SME",
    "product_type": "AI_SAAS",
    "markets": ["EU", "UK", "US"],
    "as_of_date": "2026-03-11"
  }'
```

## Import JSON format
`format: "json"` with `data` containing a JSON string of either:
- `[{...}]`
- `{ "items": [{...}] }`

Each item supports either:
- `versions: [...]` (recommended)
- flat fields (`version`, `effective_from`, `repealed_on`, `status`, `conditions`) for a single version

## Import CSV format
`format: "csv"` with `data` as CSV text.
Use columns shown in [data/regulations.import.template.csv](/Users/tarunagarwal/Documents/1_App%20Developement%20-%20Tarun/Regulatory%20Applicability%20Checker/data/regulations.import.template.csv).
Multi-value columns can use `,` or `|` separators.

## Note
This is a legal triage engine for scope screening and prioritization, not legal advice.
