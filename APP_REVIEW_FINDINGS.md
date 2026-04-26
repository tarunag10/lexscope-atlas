# LexScope Atlas App Review Findings

Review date: 2026-04-26

## Summary

The core logic test suite is passing, but the app has several issues in browser-facing behavior, security posture, and user experience. The highest-priority items are a broken dashboard heatmap, unsafe raw HTML rendering, and client-side API key exposure.

## Findings

### Finding 1: Dashboard heatmap always shows zero counts

- Priority: P1
- Status: Fixed
- File: `dashboard.html`
- Line: 115

The dashboard reads `d.dimension`, but engine check objects are emitted as `{ id, label, status, detail }`. Because `d.dimension` is undefined, every check is skipped and the Dimension Pass / Fail Heatmap is misleading.

Recommendation: use `d.id` here, or rename the engine field consistently.

### Finding 2: User/imported/AI text is rendered as raw HTML

- Priority: P1
- Status: Partially fixed
- File: `index.html`
- Line: 393

Several UI paths inject unescaped strings into `innerHTML`, including imported regulation fields, AI summaries, news article fields, checklist items, printable reports, and error messages. Since imported data and provider responses are not trusted, this can become stored or reflected XSS.

Progress: added a shared `escapeHtml` helper and applied it to the main evaluator, checklist, news, compare, and printable report render paths. Remaining hardening should include URL scheme validation and reducing inline event handlers.

Recommendation: prefer DOM APIs and `textContent`, or use `escapeHtml` before templating.

### Finding 3: API keys are exposed from the browser

- Priority: P1
- Status: Not fixed
- File: `shared.js`
- Line: 13

OpenAI, Gemini, Groq, GNews, and Supabase keys are stored in localStorage and sent directly from client code. For a public Vercel app, this makes user keys accessible to any script running on the origin and prevents server-side rate limiting, auditing, or abuse protection.

Recommendation: move AI/news calls behind a backend or serverless proxy and keep only user session tokens client-side.

### Finding 4: Compare page discards served markets

- Priority: P2
- Status: Fixed
- File: `compare.html`
- Line: 85

Jurisdiction comparison replaces the base profile markets with `[jurCode]`. That means a company serving EU/UK/US globally is compared as if it only serves one domestic market at a time, which can hide extraterritorial regulations and make the comparison less useful.

Recommendation: preserve selected markets and only vary home jurisdiction, or add an explicit toggle for domestic-only comparison.

### Finding 5: README local preview instruction is misleading

- Priority: P2
- Status: Fixed
- File: `README.md`
- Line: 22

The README says to open `index.html` directly, but the app fetches JSON modules/data with `fetch('./data/...')`; many browsers block or alter that behavior under `file://`.

Recommendation: document a local static server command, such as `python3 -m http.server 4173`, or add a Vite/static preview command.

### Finding 6: CSV parser will break on quoted commas

- Priority: P2
- Status: Fixed
- File: `engine.js`
- Line: 357

`parseCsv` splits each line on commas directly, so valid CSV like names, summaries, or URLs containing quoted commas will be imported incorrectly.

Recommendation: use a real CSV parser or at least a quoted-field parser for admin imports.

## UI/UX Improvement Ideas

- Replace the markets multi-select with searchable chips. Cmd/Ctrl-click is hard to discover and awkward on mobile.
- Add filters and sorting to results: applicable only, high confidence, jurisdiction, authority, and changed since last run.
- Add a compact next-action row to each applicable regulation card.
- Make the primary Evaluate action sticky on mobile.
- Add clearer AI disclaimers and source grounding for generated summaries and checklists.
- Improve empty/error states for AI checklist generation, especially when the provider returns text that is not a numbered list.

## Logic Improvement Ideas

- Add browser/page integration tests for dashboard charts, compare behavior, share URL hydration, imports, and exports.
- Separate regulatory trigger types in the catalog, such as entity-location based, market/user based, and activity/licensing based.
- Make comparison behavior explicit: global-market comparison versus domestic-only comparison.

## Verification Notes

- `npm test` passed: 86 tests across 4 files.
- JSON catalog files parsed successfully.
- Browser smoke verification passed with system Chrome on `http://127.0.0.1:4180`: main evaluation rendered 46 regulations, dashboard charts mounted, and compare rendered 46 rows.
- Playwright-managed Chromium installation could not be completed because it failed with `ENOSPC` due to low disk space, so system Chrome was used instead.
