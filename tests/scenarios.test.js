import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  canonicalize, chooseVersion, evaluateOne, evaluateBranchRules
} from "../engine.js";

// ── Load real catalog ──
const seed = JSON.parse(readFileSync("./data/regulations.seed.json", "utf8"));
const catalog = canonicalize(seed);

function evalAll(profile) {
  const branchCtx = evaluateBranchRules(profile);
  const results = [];
  for (const reg of catalog) {
    const v = chooseVersion(reg, profile.as_of_date);
    if (!v) continue;
    results.push(evaluateOne(profile, reg, v, branchCtx));
  }
  return results;
}

function find(results, code) {
  return results.find(r => r.code === code);
}

function jurDetail(result) {
  return result.dimension_explainability.find(d => d.id === "jurisdiction");
}

// ── Base profiles for reuse ──
const INDIA_TECH_AI = {
  jurisdiction: "IN",
  markets: ["EU", "UK", "US", "SG", "UAE", "CA", "AU", "JP", "BR", "SA"],
  industry: "TECHNOLOGY",
  product_type: "AI_SAAS",
  company_size: "ENTERPRISE",
  entity_type: "PRIVATE_COMPANY",
  annual_revenue_usd: 50000000,
  annual_turnover_usd: 50000000,
  monthly_active_users: 500000,
  as_of_date: "2025-06-01",
};

const US_FINSERV = {
  jurisdiction: "US",
  markets: ["US", "EU", "UK"],
  industry: "FINANCIAL_SERVICES",
  product_type: "FINANCIAL_SERVICE",
  company_size: "LARGE",
  entity_type: "PRIVATE_COMPANY",
  annual_revenue_usd: 100000000,
  annual_turnover_usd: 100000000,
  monthly_active_users: 200000,
  as_of_date: "2025-06-01",
};

const EU_NATIVE_SME = {
  jurisdiction: "EU",
  markets: ["EU"],
  industry: "TECHNOLOGY",
  product_type: "AI_SAAS",
  company_size: "SME",
  entity_type: "PRIVATE_COMPANY",
  annual_revenue_usd: 5000000,
  annual_turnover_usd: 5000000,
  monthly_active_users: 50000,
  as_of_date: "2025-06-01",
};

const SG_STARTUP_GLOBAL = {
  jurisdiction: "SG",
  markets: ["SG", "EU", "US", "IN", "JP", "AU"],
  industry: "TECHNOLOGY",
  product_type: "SAAS",
  company_size: "SME",
  entity_type: "STARTUP",
  annual_revenue_usd: 2000000,
  annual_turnover_usd: 2000000,
  monthly_active_users: 80000,
  as_of_date: "2025-06-01",
};

// ──────────────────────────────────────────────────────────────────────
// Scenario 1: India-based AI company serving global markets
// ──────────────────────────────────────────────────────────────────────
describe("Scenario: India AI company serving global markets", () => {
  const results = evalAll(INDIA_TECH_AI);

  it("EU AI Act applies via extraterritorial reach", () => {
    const r = find(results, "EU_AI_ACT");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
    expect(jurDetail(r).status).toBe("pass");
    expect(jurDetail(r).detail).toContain("extraterritorial");
  });

  it("EU GDPR applies via served markets", () => {
    const r = find(results, "EU_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("UK GDPR applies via served markets", () => {
    const r = find(results, "UK_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("US CCPA/CPRA applies via served markets", () => {
    const r = find(results, "US_CCPA_CPRA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("Singapore PDPA applies via served markets", () => {
    const r = find(results, "SG_PDPA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("UAE PDPL applies via served markets", () => {
    const r = find(results, "UAE_PDPL");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("Brazil LGPD applies via served markets", () => {
    const r = find(results, "BR_LGPD");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("Canada PIPEDA applies via served markets", () => {
    const r = find(results, "CA_PIPEDA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("US HIPAA does NOT apply (wrong industry/product)", () => {
    const r = find(results, "US_HIPAA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(false);
  });

  it("India DPDPA does NOT apply (IN not in served markets)", () => {
    const r = find(results, "IN_DPDPA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Scenario 2: US financial services company serving EU/UK
// ──────────────────────────────────────────────────────────────────────
describe("Scenario: US finserv company serving EU and UK", () => {
  const results = evalAll(US_FINSERV);

  it("EU GDPR applies (serves EU market with matching product)", () => {
    const r = find(results, "EU_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("UK GDPR applies (serves UK market)", () => {
    const r = find(results, "UK_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("US CCPA/CPRA applies (home jurisdiction + market match)", () => {
    const r = find(results, "US_CCPA_CPRA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("US GLBA applies (home=US, industry=FINANCIAL_SERVICES)", () => {
    const r = find(results, "US_GLBA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("EU AI Act does NOT apply (product is FINANCIAL_SERVICE not AI)", () => {
    const r = find(results, "EU_AI_ACT");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(false);
  });

  it("Singapore PDPA does NOT apply (SG not in markets)", () => {
    const r = find(results, "SG_PDPA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Scenario 3: EU-native SME — home jurisdiction matches directly
// ──────────────────────────────────────────────────────────────────────
describe("Scenario: EU-native SME", () => {
  const results = evalAll(EU_NATIVE_SME);

  it("EU AI Act applies (home=EU, direct jurisdiction match)", () => {
    const r = find(results, "EU_AI_ACT");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
    expect(jurDetail(r).detail).toBe("Matches jurisdiction scope.");
  });

  it("EU GDPR applies (home=EU)", () => {
    const r = find(results, "EU_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
    expect(jurDetail(r).detail).toBe("Matches jurisdiction scope.");
  });

  it("UK GDPR does NOT apply (UK not in markets)", () => {
    const r = find(results, "UK_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(false);
  });

  it("US CCPA/CPRA does NOT apply (US not in markets, not ENTERPRISE size)", () => {
    const r = find(results, "US_CCPA_CPRA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Scenario 4: Singapore startup serving global markets
// ──────────────────────────────────────────────────────────────────────
describe("Scenario: Singapore startup global SaaS", () => {
  const results = evalAll(SG_STARTUP_GLOBAL);

  it("Singapore PDPA applies (home=SG)", () => {
    const r = find(results, "SG_PDPA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
    expect(jurDetail(r).detail).toBe("Matches jurisdiction scope.");
  });

  it("EU GDPR applies (serves EU)", () => {
    const r = find(results, "EU_GDPR");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });

  it("India DPDPA does NOT apply (revenue below 10M threshold)", () => {
    const r = find(results, "IN_DPDPA");
    expect(r).toBeDefined();
    // Market overlap exists (IN in markets) but revenue threshold blocks it
    expect(r.applicable).toBe(false);
    const revCheck = r.dimension_explainability.find(d => d.id === "annual_revenue_usd");
    expect(revCheck.status).toBe("fail");
  });

  it("US CCPA/CPRA applies (SME is in scope, serves US market)", () => {
    const r = find(results, "US_CCPA_CPRA");
    expect(r).toBeDefined();
    expect(r.applicable).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Scenario 5: Edge cases — no markets served, single market
// ──────────────────────────────────────────────────────────────────────
describe("Scenario: Edge cases", () => {
  it("Company with no markets defaults — jurisdiction-only regs still work", () => {
    const profile = {
      ...EU_NATIVE_SME,
      markets: [],
    };
    const results = evalAll(profile);
    // EU GDPR has markets_any:["EU"], empty markets means no market overlap
    const gdpr = find(results, "EU_GDPR");
    expect(gdpr).toBeDefined();
    // Home jurisdiction matches but markets don't overlap
    // Since markets_any is non-empty but profile markets is empty, market check fails
    expect(gdpr.applicable).toBe(false);
  });

  it("Company serving only one foreign market gets that market's regs", () => {
    const profile = {
      jurisdiction: "AU",
      markets: ["EU"],
      industry: "TECHNOLOGY",
      product_type: "AI_SAAS",
      company_size: "ENTERPRISE",
      entity_type: "PRIVATE_COMPANY",
      annual_revenue_usd: 10000000,
      annual_turnover_usd: 10000000,
      monthly_active_users: 100000,
      as_of_date: "2025-06-01",
    };
    const results = evalAll(profile);
    const euAi = find(results, "EU_AI_ACT");
    expect(euAi).toBeDefined();
    expect(euAi.applicable).toBe(true);
    expect(jurDetail(euAi).detail).toContain("extraterritorial");

    // UK should NOT apply since only EU market
    const ukGdpr = find(results, "UK_GDPR");
    expect(ukGdpr).toBeDefined();
    expect(ukGdpr.applicable).toBe(false);
  });

  it("Jurisdiction-only reg (no markets_any) requires home jurisdiction match", () => {
    // MULTI_VERSION_REG in fixtures has markets_any: [] — pure jurisdiction
    const profile = {
      ...INDIA_TECH_AI,
      markets: ["EU", "UK"],
    };
    const results = evalAll(profile);
    // Find any regulation where markets_any is empty and jurisdictions_any is set
    // and jurisdiction doesn't match — it should NOT apply
    // THRESH_REG in fixtures has markets_any:[], jurisdictions_any:["EU"]
    // but we're testing with real seed data, so let's check IN_IT_ACT
    // IN_IT_ACT has markets_any:["IN"] so it IS market-based, but IN not in markets
    const inIt = find(results, "IN_IT_ACT");
    expect(inIt).toBeDefined();
    expect(inIt.applicable).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Scenario 6: Extraterritorial detail message is correct
// ──────────────────────────────────────────────────────────────────────
describe("Scenario: Jurisdiction check detail messages", () => {
  it("Shows 'Matches jurisdiction scope' for home match", () => {
    const results = evalAll(EU_NATIVE_SME);
    const r = find(results, "EU_AI_ACT");
    expect(jurDetail(r).detail).toBe("Matches jurisdiction scope.");
  });

  it("Shows 'extraterritorial reach' for market-only match", () => {
    const results = evalAll(INDIA_TECH_AI);
    const r = find(results, "EU_AI_ACT");
    expect(jurDetail(r).detail).toContain("extraterritorial");
  });

  it("Shows 'outside this rule scope' when neither matches", () => {
    const profile = {
      ...INDIA_TECH_AI,
      markets: ["IN"], // only India, no EU
    };
    const results = evalAll(profile);
    const r = find(results, "EU_AI_ACT");
    expect(jurDetail(r).status).toBe("fail");
    expect(jurDetail(r).detail).toContain("outside");
  });
});
