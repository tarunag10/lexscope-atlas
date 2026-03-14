// ── LexScope Atlas — Pure Logic Engine (ES Module) ──

export const OPTIONS = {
  jurisdictions: [
    ["EU", "European Union"], ["UK", "United Kingdom"], ["US", "United States"], ["SG", "Singapore"],
    ["UAE", "United Arab Emirates"], ["IN", "India"], ["CA", "Canada"], ["AU", "Australia"],
    ["JP", "Japan"], ["BR", "Brazil"], ["SA", "Saudi Arabia"]
  ],
  industries: [
    ["TECHNOLOGY", "Technology"], ["ECOMMERCE", "E-commerce / Marketplace"], ["FINANCIAL_SERVICES", "Financial Services"],
    ["INSURANCE", "Insurance"], ["HEALTHCARE", "Healthcare"], ["MEDIA", "Media"], ["MANUFACTURING", "Manufacturing"],
    ["ENERGY", "Energy"], ["TELECOM", "Telecommunications"], ["EDTECH", "Education Technology"],
    ["PUBLIC_SECTOR", "Public Sector"], ["GAMING", "Gaming"]
  ],
  company_sizes: [
    ["MICRO", "Micro (<10 employees)"], ["SME", "SME (10-249)"], ["MID", "Mid-Market (250-999)"],
    ["LARGE", "Large (1,000-4,999)"], ["ENTERPRISE", "Enterprise (5,000+)"]
  ],
  product_types: [
    ["AI_MODEL", "AI foundation model"], ["AI_SAAS", "AI SaaS application"], ["AI_EMBEDDED", "AI-enabled physical product"],
    ["DIGITAL_PLATFORM", "Digital platform"], ["SOCIAL_PLATFORM", "Social platform"], ["SEARCH_SERVICE", "Search service"],
    ["MARKETPLACE", "Marketplace"], ["SAAS", "General SaaS"], ["MOBILE_APP", "Mobile app"],
    ["IOT_DEVICE", "IoT device"], ["FINANCIAL_SERVICE", "Financial service"], ["INVESTMENT_PRODUCT", "Investment product"],
    ["INSURANCE_PRODUCT", "Insurance product"], ["HEALTH_TECH", "Health-tech solution"], ["PAYMENTS", "Payments service"],
    ["CRYPTO_ASSET", "Crypto-asset service"]
  ],
  entity_types: [
    ["PRIVATE_COMPANY", "Private company"], ["PUBLIC_COMPANY", "Public company"], ["STARTUP", "Startup"],
    ["BANK", "Bank"], ["INSURER", "Insurer"], ["PAYMENT_INSTITUTION", "Payment institution"],
    ["VASP", "Virtual asset service provider"], ["MARKETPLACE_OPERATOR", "Marketplace operator"]
  ]
};

export const BRANCH_RULES = [
  {
    id: "UK_FINANCIAL_PAYMENTS_FORCE_PSR",
    when: { jurisdiction: "UK", industry: "FINANCIAL_SERVICES", product_type: "PAYMENTS" },
    force_include_codes: ["UK_PSR_2017"],
    explanation: "UK payments activity in financial services triggers explicit Payment Services Regulations screening."
  },
  {
    id: "EU_FINANCIAL_FORCE_MIFID",
    when: { jurisdiction: "EU", industry: "FINANCIAL_SERVICES" },
    force_include_codes: ["EU_MIFID_II"],
    explanation: "EU financial services entities must be screened against MiFID II investment regulation."
  },
  {
    id: "US_HEALTHCARE_FORCE_HIPAA",
    when: { jurisdiction: "US", industry: "HEALTHCARE" },
    force_include_codes: ["US_HIPAA"],
    explanation: "US healthcare entities must comply with HIPAA patient data protection rules."
  },
  {
    id: "US_FINANCIAL_PAYMENTS_FORCE_GLBA",
    when: { jurisdiction: "US", industry: "FINANCIAL_SERVICES", product_type: "PAYMENTS" },
    force_include_codes: ["US_GLBA"],
    explanation: "US financial services with payments activity triggers Gramm-Leach-Bliley Act screening."
  },
  {
    id: "EU_INSURANCE_FORCE_SOLVENCY",
    when: { jurisdiction: "EU", industry: "INSURANCE" },
    force_include_codes: ["EU_SOLVENCY_II"],
    explanation: "EU insurance entities must be screened against Solvency II prudential requirements."
  },
  {
    id: "IN_FINANCIAL_PAYMENTS_FORCE_PSS",
    when: { jurisdiction: "IN", industry: "FINANCIAL_SERVICES", product_type: "PAYMENTS" },
    force_include_codes: ["IN_PSS_ACT"],
    explanation: "Indian financial services with payments activity triggers Payment and Settlement Systems Act screening."
  },
  {
    id: "UK_FINANCIAL_FORCE_CONSUMER_DUTY",
    when: { jurisdiction: "UK", industry: "FINANCIAL_SERVICES" },
    force_include_codes: ["UK_CONSUMER_DUTY"],
    explanation: "UK financial services entities must be screened against FCA Consumer Duty requirements."
  }
];

export function parseDate(str) {
  return new Date(`${str}T00:00:00Z`);
}

export function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim().toUpperCase()).filter(Boolean);
  return [String(value).trim().toUpperCase()].filter(Boolean);
}

export function normalizeConditions(raw) {
  const c = raw || {};
  return {
    jurisdictions_any: normalizeArray(c.jurisdictions_any),
    markets_any: normalizeArray(c.markets_any),
    industries_any: normalizeArray(c.industries_any),
    product_types_any: normalizeArray(c.product_types_any),
    company_sizes_any: normalizeArray(c.company_sizes_any),
    entity_types_any: normalizeArray(c.entity_types_any),
  };
}

export function normalizeThresholds(raw) {
  const t = raw || {};
  const numeric = (value) => {
    const n = Number(value);
    return (value !== null && value !== undefined && value !== "" && Number.isFinite(n)) ? n : null;
  };
  return {
    min_annual_revenue_usd: numeric(t.min_annual_revenue_usd),
    max_annual_revenue_usd: numeric(t.max_annual_revenue_usd),
    min_annual_turnover_usd: numeric(t.min_annual_turnover_usd),
    max_annual_turnover_usd: numeric(t.max_annual_turnover_usd),
    min_monthly_active_users: numeric(t.min_monthly_active_users),
    max_monthly_active_users: numeric(t.max_monthly_active_users),
  };
}

export function normalizeExemptions(raw) {
  const ex = raw || {};
  return {
    company_sizes_any: normalizeArray(ex.company_sizes_any),
    entity_types_any: normalizeArray(ex.entity_types_any),
    max_annual_revenue_usd: normalizeThresholds(ex).max_annual_revenue_usd,
    max_annual_turnover_usd: normalizeThresholds(ex).max_annual_turnover_usd,
    max_monthly_active_users: normalizeThresholds(ex).max_monthly_active_users,
  };
}

export function canonicalize(items) {
  return items.map((item) => {
    const versions = item.versions && Array.isArray(item.versions) ? item.versions : [{
      version: Number(item.version || 1),
      effective_from: item.effective_from || "2020-01-01",
      repealed_on: item.repealed_on || null,
      status: (item.status || "ACTIVE").toUpperCase(),
      notes: item.notes || "",
      conditions: item.conditions || {}
    }];

    return {
      code: String(item.code).trim().toUpperCase(),
      name: String(item.name || "").trim(),
      authority: String(item.authority || "").trim(),
      summary: String(item.summary || "").trim(),
      source_url: String(item.source_url || "").trim(),
      related_regulations: Array.isArray(item.related_regulations) ? item.related_regulations : [],
      versions: versions.map(v => ({
        version: Number(v.version || 1),
        effective_from: String(v.effective_from || "2020-01-01"),
        repealed_on: v.repealed_on ? String(v.repealed_on) : null,
        status: String(v.status || "ACTIVE").toUpperCase(),
        notes: String(v.notes || ""),
        conditions: normalizeConditions(v.conditions),
        entity_types_any: normalizeArray(v.entity_types_any || (v.conditions ? v.conditions.entity_types_any : [])),
        thresholds: normalizeThresholds(v.thresholds),
        exemptions: normalizeExemptions(v.exemptions),
      }))
    };
  }).filter(x => x.code && x.name);
}

export function chooseVersion(reg, asOf) {
  const day = parseDate(asOf);
  const matches = reg.versions.filter((v) => {
    const start = parseDate(v.effective_from);
    const end = v.repealed_on ? parseDate(v.repealed_on) : null;
    return start <= day && (!end || day < end);
  });
  if (!matches.length) return null;
  return matches.sort((a, b) => b.version - a.version)[0];
}

export function match(value, allowed) {
  return !allowed.length || allowed.includes(value);
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function evaluateBranchRules(profile) {
  const forcedCodes = new Set();
  const explanations = [];
  BRANCH_RULES.forEach((rule) => {
    const ok = Object.entries(rule.when).every(([k, v]) => profile[k] === v);
    if (ok) {
      rule.force_include_codes.forEach((code) => forcedCodes.add(code));
      explanations.push(rule.explanation);
    }
  });
  return { forcedCodes, explanations };
}

export function evaluateOne(profile, reg, version, branchContext) {
  const c = version.conditions;
  const t = version.thresholds || {};
  const ex = version.exemptions || {};
  const checks = [];
  const addCheck = (id, label, status, detail) => checks.push({ id, label, status, detail });
  const passFail = (condition, passDetail, failDetail) => condition ? ["pass", passDetail] : ["fail", failDetail];

  let status;
  let detail;

  [status, detail] = passFail(
    match(profile.jurisdiction, c.jurisdictions_any),
    "Matches jurisdiction scope.",
    "Jurisdiction is outside this rule scope."
  );
  addCheck("jurisdiction", "Home jurisdiction", status, detail);

  [status, detail] = passFail(
    !c.markets_any.length || profile.markets.some((m) => c.markets_any.includes(m)),
    "Served markets overlap with scope.",
    "No served market overlap with scope."
  );
  addCheck("market", "Served markets", status, detail);

  [status, detail] = passFail(
    match(profile.industry, c.industries_any),
    "Industry is in scope.",
    "Industry is outside this rule scope."
  );
  addCheck("industry", "Industry", status, detail);

  [status, detail] = passFail(
    match(profile.product_type, c.product_types_any),
    "Product type is in scope.",
    "Product type is outside this rule scope."
  );
  addCheck("product_type", "Product type", status, detail);

  [status, detail] = passFail(
    match(profile.company_size, c.company_sizes_any),
    "Company size is in scope.",
    "Company size is outside this rule scope."
  );
  addCheck("company_size", "Company size", status, detail);

  if ((version.entity_types_any || []).length) {
    [status, detail] = passFail(
      version.entity_types_any.includes(profile.entity_type),
      "Entity type is in scope.",
      "Entity type is outside this rule scope."
    );
    addCheck("entity_type", "Entity type", status, detail);
  } else {
    addCheck("entity_type", "Entity type", "neutral", "No entity-type restriction.");
  }

  const thresholdCheck = (field, labelText, minKey, maxKey) => {
    const minValue = t[minKey];
    const maxValue = t[maxKey];
    const value = profile[field];
    if (minValue === null && maxValue === null) {
      addCheck(field, labelText, "neutral", "No threshold set.");
      return;
    }
    if (value === null) {
      addCheck(field, labelText, "fail", "Threshold exists but profile value is missing.");
      return;
    }
    if (minValue !== null && value < minValue) {
      addCheck(field, labelText, "fail", `Below minimum threshold (${minValue}).`);
      return;
    }
    if (maxValue !== null && value > maxValue) {
      addCheck(field, labelText, "fail", `Above maximum threshold (${maxValue}).`);
      return;
    }
    addCheck(field, labelText, "pass", "Threshold requirement satisfied.");
  };

  thresholdCheck("annual_revenue_usd", "Annual revenue", "min_annual_revenue_usd", "max_annual_revenue_usd");
  thresholdCheck("annual_turnover_usd", "Annual turnover", "min_annual_turnover_usd", "max_annual_turnover_usd");
  thresholdCheck("monthly_active_users", "Monthly active users", "min_monthly_active_users", "max_monthly_active_users");

  const exemptionChecks = [];
  if (ex.company_sizes_any.length) exemptionChecks.push(ex.company_sizes_any.includes(profile.company_size));
  if (ex.entity_types_any.length) exemptionChecks.push(ex.entity_types_any.includes(profile.entity_type));
  if (ex.max_annual_revenue_usd !== null) exemptionChecks.push(profile.annual_revenue_usd !== null && profile.annual_revenue_usd <= ex.max_annual_revenue_usd);
  if (ex.max_annual_turnover_usd !== null) exemptionChecks.push(profile.annual_turnover_usd !== null && profile.annual_turnover_usd <= ex.max_annual_turnover_usd);
  if (ex.max_monthly_active_users !== null) exemptionChecks.push(profile.monthly_active_users !== null && profile.monthly_active_users <= ex.max_monthly_active_users);
  const exemptionTriggered = exemptionChecks.length > 0 && exemptionChecks.every(Boolean);

  addCheck(
    "exemptions",
    "Exemptions",
    exemptionChecks.length ? (exemptionTriggered ? "fail" : "pass") : "neutral",
    exemptionChecks.length
      ? (exemptionTriggered ? "Exemption criteria triggered (rule carved out)." : "No exemption criteria triggered.")
      : "No exemption criteria configured."
  );

  const hardFailures = checks.filter((k) => k.status === "fail" && k.id !== "exemptions");
  let applicable = hardFailures.length === 0 && !exemptionTriggered;
  let branchApplied = false;
  if (!applicable && branchContext.forcedCodes.has(reg.code)) {
    applicable = true;
    branchApplied = true;
    addCheck("branching", "Conditional branching", "pass", branchContext.explanations.join(" "));
  } else if (branchContext.explanations.length) {
    addCheck("branching", "Conditional branching", "neutral", "Branch rule exists but does not target this regulation.");
  }

  const relevantChecks = checks.filter((k) => k.status !== "neutral");
  const passCount = relevantChecks.filter((k) => k.status === "pass").length;
  const confidence = relevantChecks.length ? Number((passCount / relevantChecks.length).toFixed(2)) : 0.5;

  const failedLabels = checks.filter((k) => k.status === "fail").map((k) => k.label.toLowerCase());
  const passedLabels = checks.filter((k) => k.status === "pass").map((k) => k.label.toLowerCase());
  let reason = "";
  if (branchApplied) {
    reason = `This is included via conditional branch logic: ${branchContext.explanations.join(" ")}`;
  } else if (exemptionTriggered) {
    reason = "This likely does not apply because an exemption carve-out was triggered for this profile.";
  } else if (applicable) {
    reason = `This likely applies because the profile passed scoped checks (${passedLabels.join(", ")}).`;
  } else {
    reason = `This likely does not apply because these checks failed: ${failedLabels.join(", ")}.`;
  }

  return {
    code: reg.code,
    name: reg.name,
    authority: reg.authority,
    summary: reg.summary,
    source_url: reg.source_url,
    related_regulations: reg.related_regulations || [],
    version: version.version,
    effective_from: version.effective_from,
    repealed_on: version.repealed_on,
    notes: version.notes,
    applicable,
    confidence,
    reason,
    dimension_explainability: checks
  };
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => row[h] = (cols[i] || "").trim());
    return row;
  });

  const byCode = {};
  for (const row of rows) {
    const code = (row.code || "").toUpperCase();
    if (!code) continue;
    if (!byCode[code]) {
      byCode[code] = {
        code,
        name: row.name,
        authority: row.authority,
        summary: row.summary,
        source_url: row.source_url,
        versions: []
      };
    }
    const split = (value) => String(value || "").replace(/\|/g, ",").split(",").map(s => s.trim()).filter(Boolean);
    byCode[code].versions.push({
      version: Number(row.version || 1),
      effective_from: row.effective_from || "2020-01-01",
      repealed_on: row.repealed_on || null,
      status: (row.status || "ACTIVE").toUpperCase(),
      notes: row.notes || "",
      entity_types_any: split(row.entity_types_any),
      thresholds: {
        min_annual_revenue_usd: toNumberOrNull(row.min_annual_revenue_usd),
        min_annual_turnover_usd: toNumberOrNull(row.min_annual_turnover_usd),
        min_monthly_active_users: toNumberOrNull(row.min_monthly_active_users),
        max_annual_revenue_usd: toNumberOrNull(row.max_annual_revenue_usd),
        max_annual_turnover_usd: toNumberOrNull(row.max_annual_turnover_usd),
        max_monthly_active_users: toNumberOrNull(row.max_monthly_active_users),
      },
      exemptions: {
        company_sizes_any: split(row.exemption_company_sizes_any),
        entity_types_any: split(row.exemption_entity_types_any),
        max_annual_revenue_usd: toNumberOrNull(row.exemption_max_annual_revenue_usd),
        max_annual_turnover_usd: toNumberOrNull(row.exemption_max_annual_turnover_usd),
        max_monthly_active_users: toNumberOrNull(row.exemption_max_monthly_active_users),
      },
      conditions: {
        jurisdictions_any: split(row.jurisdictions_any),
        markets_any: split(row.markets_any),
        industries_any: split(row.industries_any),
        product_types_any: split(row.product_types_any),
        company_sizes_any: split(row.company_sizes_any),
        entity_types_any: split(row.entity_types_any),
      }
    });
  }
  return Object.values(byCode);
}

// ── New Tier 2 Functions ──

const PROFILE_PARAM_MAP = {
  jurisdiction: "j",
  industry: "ind",
  company_size: "cs",
  product_type: "pt",
  entity_type: "et",
  annual_revenue_usd: "rev",
  annual_turnover_usd: "turn",
  monthly_active_users: "mau",
  as_of_date: "date",
  markets: "mk",
};

export function profileToParams(profile) {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(PROFILE_PARAM_MAP)) {
    const val = profile[key];
    if (val === null || val === undefined || val === "") continue;
    if (Array.isArray(val)) {
      if (val.length) params.set(param, val.join(","));
    } else {
      params.set(param, String(val));
    }
  }
  return params;
}

export function paramsToProfile(params) {
  const get = (key) => params.get(key) || "";
  const num = (key) => { const v = params.get(key); return v ? toNumberOrNull(v) : null; };
  return {
    jurisdiction: get(PROFILE_PARAM_MAP.jurisdiction),
    industry: get(PROFILE_PARAM_MAP.industry),
    company_size: get(PROFILE_PARAM_MAP.company_size),
    product_type: get(PROFILE_PARAM_MAP.product_type),
    entity_type: get(PROFILE_PARAM_MAP.entity_type),
    annual_revenue_usd: num(PROFILE_PARAM_MAP.annual_revenue_usd),
    annual_turnover_usd: num(PROFILE_PARAM_MAP.annual_turnover_usd),
    monthly_active_users: num(PROFILE_PARAM_MAP.monthly_active_users),
    as_of_date: get(PROFILE_PARAM_MAP.as_of_date),
    markets: get(PROFILE_PARAM_MAP.markets) ? get(PROFILE_PARAM_MAP.markets).split(",") : [],
  };
}

export function buildTimeline(reg, asOfDate) {
  const asOf = asOfDate ? parseDate(asOfDate) : new Date();
  return reg.versions
    .slice()
    .sort((a, b) => parseDate(a.effective_from) - parseDate(b.effective_from))
    .map((v) => {
      const start = parseDate(v.effective_from);
      const end = v.repealed_on ? parseDate(v.repealed_on) : null;
      const isActive = start <= asOf && (!end || asOf < end);
      return { ...v, isActive };
    });
}

export function buildDependencyGraph(results) {
  const codeSet = new Set(results.map(r => r.code));
  const nodes = results.map(r => ({
    code: r.code,
    name: r.name,
    applicable: r.applicable,
  }));
  const edges = [];
  for (const r of results) {
    for (const rel of (r.related_regulations || [])) {
      edges.push({ from: r.code, to: rel, exists: codeSet.has(rel) });
    }
  }
  return { nodes, edges };
}
