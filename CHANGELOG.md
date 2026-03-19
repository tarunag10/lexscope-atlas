# Changelog — LexScope Atlas

## v3.0.0 — 2026-03-20

### New Features

#### Multi-Provider AI Support
- Added AI provider selector in Settings: **Gemini**, **OpenAI (ChatGPT)**, and **Groq (free)**
- Users can bring their own API key for any provider
- All AI features (Summarize, Chat, Checklist) automatically route to the selected provider
- New shared `callAI()` and `callAIChat()` helpers in `shared.js`
  - **Gemini**: `gemini-2.0-flash` via `generativelanguage.googleapis.com`
  - **OpenAI**: `gpt-4o-mini` via `api.openai.com`
  - **Groq**: `llama-3.3-70b-versatile` via `api.groq.com` (free tier available)
- Graceful "Add AI key in Settings" prompts when no key is configured

#### AI Regulation Summarizer (`index.html`)
- New "Summarize" button on every regulation card
- Generates a 3-4 sentence AI summary of what the regulation means for the company
- Summaries are cached in `sessionStorage` to avoid redundant API calls
- Works with any configured AI provider

#### Compliance Checklist (`checklist.html`)
- New dedicated page for AI-generated compliance checklists
- Dropdown of applicable regulations (from last evaluation)
- "Generate" button produces 8-12 actionable compliance items
- Interactive checkboxes with state persisted in `localStorage` per regulation
- Checkbox state survives page reloads and browser restarts

#### Jurisdiction Comparison (`compare.html`)
- New dedicated page for side-by-side jurisdiction comparison
- Two jurisdiction dropdowns populated from all supported jurisdictions
- "Compare" runs the evaluation engine client-side — no API calls needed
- Results displayed in a color-coded table:
  - Green = applicable, Red = not applicable
  - Highlighted rows where jurisdictions differ
  - Confidence percentage and diff for each regulation
- Summary stats: total regulations, differences, both applicable, neither

### Bug Fixes

#### Extraterritorial Regulation Logic (Critical Fix)
- **Problem**: An India-based company serving EU markets was incorrectly told EU AI Act, GDPR, etc. were "not applicable" because the home jurisdiction check failed (`IN` not in `["EU"]`), even though served markets overlapped
- **Root cause**: The engine treated home jurisdiction as a hard gate for ALL regulations — any single failed dimension check made the entire regulation "not applicable"
- **Fix**: Market-based regulations (those with `markets_any` populated) now pass the jurisdiction check if **either** the home jurisdiction matches **or** the served markets overlap
- Regulations correctly show "Applies via served markets (extraterritorial reach)" for foreign companies serving those markets
- Pure jurisdiction-only regulations (empty `markets_any`) remain unchanged
- **Impact**: 11+ regulations now correctly apply for cross-border scenarios (EU AI Act, GDPR, UK GDPR, CCPA, Singapore PDPA, UAE PDPL, Brazil LGPD, Canada PIPEDA, etc.)

### Improvements

#### Updated Navigation
- Nav bar now includes 7 links: **Evaluate | Dashboard | Checklist | Compare | News | AI Chat | Settings**

#### Settings Page Enhancements
- AI Provider radio group (Gemini / OpenAI / Groq)
- OpenAI API Key and Groq API Key input fields
- All keys saved to the same `lexscope_api_keys_v1` localStorage key

#### Chat Page Update
- Replaced hardcoded Gemini API calls with shared `callAIChat()` multi-provider helper
- Updated subtitle to reflect multi-provider support

#### Shared Infrastructure
- Extracted `loadCatalog()` from `index.html` to `shared.js` for reuse across pages (compare.html, etc.)
- Catalog loading: seed + auto + localStorage imports → canonicalize → deduplicate

### Tests

#### Cross-Jurisdiction Scenario Tests (30 new tests)
- **Scenario 1: India AI company → global markets** (10 tests)
  - EU AI Act, GDPR, UK GDPR, CCPA, PDPA all apply via extraterritorial reach
  - HIPAA doesn't apply (wrong industry); India DPDPA doesn't apply (not in markets)
- **Scenario 2: US finserv → EU/UK** (6 tests)
  - EU GDPR, UK GDPR, GLBA apply; EU AI Act doesn't (wrong product)
- **Scenario 3: EU-native SME** (4 tests)
  - Direct jurisdiction match works; foreign regs don't leak in
- **Scenario 4: Singapore startup → global SaaS** (4 tests)
  - Home SG PDPA + EU GDPR via markets; revenue thresholds still gate correctly
- **Scenario 5: Edge cases** (3 tests)
  - Empty markets, single foreign market, jurisdiction-only regulations
- **Scenario 6: Detail messages** (3 tests)
  - Correct text for "Matches jurisdiction scope", "extraterritorial reach", and "outside this rule scope"

**Total test suite: 81 tests (51 engine + 30 scenarios), all passing.**

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `shared.js` | Modified | Added `callAI()`, `callAIChat()`, `loadCatalog()`, updated nav |
| `shared.css` | Modified | Added summarize, checklist, and comparison table styles |
| `settings.html` | Modified | AI provider selector + OpenAI/Groq key fields |
| `index.html` | Modified | Summarize button in regulation cards, uses shared `loadCatalog` |
| `chat.html` | Modified | Uses shared `callAIChat()` instead of hardcoded Gemini |
| `engine.js` | Modified | Fixed jurisdiction check for market-based extraterritorial regulations |
| `checklist.html` | Created | Compliance checklist generator page |
| `compare.html` | Created | Jurisdiction comparison page |
| `tests/scenarios.test.js` | Created | 30 cross-jurisdiction scenario tests |

---

## v2.0.0 — Previous Release

- Multi-page feature expansion: Dashboard, News, AI Chat, Settings
- Engine module with tests, CI, dark mode, timeline, dependencies, PDF, shareable URLs
- Real thresholds/exemptions, branching rules, export, profiles, and comparison mode
- Vercel deployment
