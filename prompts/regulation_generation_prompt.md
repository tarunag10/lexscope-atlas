# LexScope Regulation Generation Prompt

Use this prompt when generating new regulations for LexScope so output remains compatible with app logic.

## Prompt
You are generating regulation records for the LexScope app.

Return only valid JSON (no markdown), as either:
- an array of regulation objects, OR
- `{ "items": [ ... ] }`

Each regulation object MUST follow this schema exactly:

```json
{
  "code": "UPPER_SNAKE_CASE_UNIQUE_ID",
  "name": "Regulation Name",
  "authority": "Country / Regulator",
  "summary": "1-2 sentence plain summary",
  "source_url": "https://official-source-url",
  "versions": [
    {
      "version": 1,
      "effective_from": "YYYY-MM-DD",
      "repealed_on": null,
      "status": "ACTIVE",
      "notes": "optional notes",
      "conditions": {
        "jurisdictions_any": ["EU"],
        "markets_any": ["EU"],
        "industries_any": ["TECHNOLOGY"],
        "product_types_any": ["AI_SAAS"],
        "company_sizes_any": ["SME", "MID", "LARGE", "ENTERPRISE"]
      }
    }
  ]
}
```

### Required constraints
- `code` must be unique and uppercase snake case.
- `source_url` should be authoritative government/regulator/legal source.
- All condition values must be UPPERCASE enums compatible with LexScope.
- Use multiple `versions` if rules changed over time.
- If a version ended, set `repealed_on` and `status` accordingly.
- Keep `summary` concise and business-readable.

### Allowed enum values
- `jurisdictions_any`, `markets_any`:
  `EU`, `UK`, `US`, `SG`, `UAE`, `IN`, `CA`, `AU`, `JP`, `BR`, `SA`
- `industries_any`:
  `TECHNOLOGY`, `ECOMMERCE`, `FINANCIAL_SERVICES`, `INSURANCE`, `HEALTHCARE`, `MEDIA`, `MANUFACTURING`, `ENERGY`, `TELECOM`, `EDTECH`, `PUBLIC_SECTOR`, `GAMING`
- `product_types_any`:
  `AI_MODEL`, `AI_SAAS`, `AI_EMBEDDED`, `DIGITAL_PLATFORM`, `SOCIAL_PLATFORM`, `SEARCH_SERVICE`, `MARKETPLACE`, `SAAS`, `MOBILE_APP`, `IOT_DEVICE`, `FINANCIAL_SERVICE`, `INVESTMENT_PRODUCT`, `INSURANCE_PRODUCT`, `HEALTH_TECH`, `PAYMENTS`, `CRYPTO_ASSET`
- `company_sizes_any`:
  `MICRO`, `SME`, `MID`, `LARGE`, `ENTERPRISE`

### Output quality
- Ensure each rule is logically coherent.
- Include only regulations that are reasonably likely to apply in practice.
- Prefer official legal sources.
- No extra keys beyond the schema.

