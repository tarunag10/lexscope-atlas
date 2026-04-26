import { describe, it, expect } from "vitest";
import {
  OPTIONS, BRANCH_RULES, parseDate, normalizeArray, normalizeConditions,
  normalizeThresholds, normalizeExemptions, canonicalize, chooseVersion,
  match, toNumberOrNull, evaluateBranchRules, evaluateOne, parseCsv,
  profileToParams, paramsToProfile, buildTimeline, buildDependencyGraph
} from "../engine.js";
import {
  DEFAULT_PROFILE, SIMPLE_REG, MULTI_VERSION_REG, THRESHOLD_REG, CSV_SAMPLE
} from "./fixtures.js";

// ── normalizeArray ──
describe("normalizeArray", () => {
  it("returns empty array for null/undefined", () => {
    expect(normalizeArray(null)).toEqual([]);
    expect(normalizeArray(undefined)).toEqual([]);
  });
  it("normalizes array of strings to uppercase", () => {
    expect(normalizeArray(["eu", " uk "])).toEqual(["EU", "UK"]);
  });
  it("wraps single string in array", () => {
    expect(normalizeArray("hello")).toEqual(["HELLO"]);
  });
  it("filters empty strings", () => {
    expect(normalizeArray(["", "us"])).toEqual(["US"]);
  });
});

// ── normalizeConditions ──
describe("normalizeConditions", () => {
  it("returns all fields with empty arrays for null input", () => {
    const c = normalizeConditions(null);
    expect(c.jurisdictions_any).toEqual([]);
    expect(c.markets_any).toEqual([]);
    expect(c.industries_any).toEqual([]);
    expect(c.product_types_any).toEqual([]);
    expect(c.company_sizes_any).toEqual([]);
    expect(c.entity_types_any).toEqual([]);
  });
  it("normalizes provided fields", () => {
    const c = normalizeConditions({ jurisdictions_any: ["eu"], markets_any: "uk" });
    expect(c.jurisdictions_any).toEqual(["EU"]);
    expect(c.markets_any).toEqual(["UK"]);
  });
});

// ── normalizeThresholds ──
describe("normalizeThresholds", () => {
  it("returns all nulls for empty input", () => {
    const t = normalizeThresholds(null);
    expect(t.min_annual_revenue_usd).toBeNull();
    expect(t.max_annual_revenue_usd).toBeNull();
  });
  it("parses numeric values", () => {
    const t = normalizeThresholds({ min_annual_revenue_usd: "1000" });
    expect(t.min_annual_revenue_usd).toBe(1000);
  });
  it("returns null for non-numeric", () => {
    const t = normalizeThresholds({ min_annual_revenue_usd: "abc" });
    expect(t.min_annual_revenue_usd).toBeNull();
  });
});

// ── normalizeExemptions ──
describe("normalizeExemptions", () => {
  it("returns defaults for null", () => {
    const e = normalizeExemptions(null);
    expect(e.company_sizes_any).toEqual([]);
    expect(e.entity_types_any).toEqual([]);
    expect(e.max_annual_revenue_usd).toBeNull();
  });
  it("normalizes exemption fields", () => {
    const e = normalizeExemptions({ company_sizes_any: ["micro"], max_annual_revenue_usd: 5000 });
    expect(e.company_sizes_any).toEqual(["MICRO"]);
    expect(e.max_annual_revenue_usd).toBe(5000);
  });
});

// ── canonicalize ──
describe("canonicalize", () => {
  it("normalizes a raw regulation object", () => {
    const result = canonicalize([{
      code: " test_code ",
      name: "Test",
      versions: [{ version: 1, effective_from: "2020-01-01", conditions: { jurisdictions_any: ["eu"] } }]
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("TEST_CODE");
    expect(result[0].versions[0].conditions.jurisdictions_any).toEqual(["EU"]);
  });
  it("filters items without code or name", () => {
    const result = canonicalize([{ code: "", name: "Test" }, { code: "X", name: "" }]);
    expect(result).toHaveLength(0);
  });
  it("preserves related_regulations", () => {
    const result = canonicalize([{
      code: "A", name: "A Reg", related_regulations: ["B", "C"],
      versions: [{ version: 1, effective_from: "2020-01-01", conditions: {} }]
    }]);
    expect(result[0].related_regulations).toEqual(["B", "C"]);
  });
  it("creates default version from flat structure", () => {
    const result = canonicalize([{
      code: "FLAT", name: "Flat Reg", effective_from: "2022-03-01", conditions: { jurisdictions_any: ["US"] }
    }]);
    expect(result[0].versions).toHaveLength(1);
    expect(result[0].versions[0].effective_from).toBe("2022-03-01");
  });
});

// ── chooseVersion ──
describe("chooseVersion", () => {
  it("returns the active version for a given date", () => {
    const v = chooseVersion(MULTI_VERSION_REG, "2024-01-01");
    expect(v.version).toBe(2);
  });
  it("returns the older version for a date before repeal", () => {
    const v = chooseVersion(MULTI_VERSION_REG, "2022-01-01");
    expect(v.version).toBe(1);
  });
  it("returns null when no version matches", () => {
    const v = chooseVersion(MULTI_VERSION_REG, "2019-01-01");
    expect(v).toBeNull();
  });
  it("returns latest version number when multiple active", () => {
    const v = chooseVersion(SIMPLE_REG, "2025-01-01");
    expect(v.version).toBe(1);
  });
});

// ── match ──
describe("match", () => {
  it("returns true when allowed is empty", () => {
    expect(match("anything", [])).toBe(true);
  });
  it("returns true when value is in allowed", () => {
    expect(match("EU", ["EU", "UK"])).toBe(true);
  });
  it("returns false when value is not in allowed", () => {
    expect(match("US", ["EU", "UK"])).toBe(false);
  });
});

// ── toNumberOrNull ──
describe("toNumberOrNull", () => {
  it("returns null for null/undefined/empty", () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull("")).toBeNull();
  });
  it("parses valid numbers", () => {
    expect(toNumberOrNull("42")).toBe(42);
    expect(toNumberOrNull(3.14)).toBe(3.14);
  });
  it("returns null for NaN", () => {
    expect(toNumberOrNull("abc")).toBeNull();
    expect(toNumberOrNull(NaN)).toBeNull();
  });
  it("returns null for Infinity", () => {
    expect(toNumberOrNull(Infinity)).toBeNull();
  });
});

// ── evaluateBranchRules ──
describe("evaluateBranchRules", () => {
  it("returns empty when no rules match", () => {
    const ctx = evaluateBranchRules({ jurisdiction: "AU", industry: "MEDIA", product_type: "SAAS" });
    expect(ctx.forcedCodes.size).toBe(0);
    expect(ctx.explanations).toHaveLength(0);
  });
  it("forces codes when rule matches", () => {
    const ctx = evaluateBranchRules({ jurisdiction: "UK", industry: "FINANCIAL_SERVICES", product_type: "PAYMENTS" });
    expect(ctx.forcedCodes.has("UK_PSR_2017")).toBe(true);
    expect(ctx.forcedCodes.has("UK_CONSUMER_DUTY")).toBe(true);
    expect(ctx.explanations.length).toBeGreaterThan(0);
  });
  it("matches US healthcare to HIPAA", () => {
    const ctx = evaluateBranchRules({ jurisdiction: "US", industry: "HEALTHCARE", product_type: "HEALTH_TECH" });
    expect(ctx.forcedCodes.has("US_HIPAA")).toBe(true);
  });
});

// ── evaluateOne ──
describe("evaluateOne", () => {
  const noForce = { forcedCodes: new Set(), explanations: [] };

  it("marks matching regulation as applicable", () => {
    const v = chooseVersion(SIMPLE_REG, "2025-01-01");
    const result = evaluateOne(DEFAULT_PROFILE, SIMPLE_REG, v, noForce);
    expect(result.applicable).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.code).toBe("TEST_REG");
  });

  it("marks non-matching jurisdiction as not applicable", () => {
    const profile = { ...DEFAULT_PROFILE, jurisdiction: "JP", markets: ["JP"] };
    const v = chooseVersion(SIMPLE_REG, "2025-01-01");
    const result = evaluateOne(profile, SIMPLE_REG, v, noForce);
    expect(result.applicable).toBe(false);
  });

  it("passes threshold checks within range", () => {
    const v = chooseVersion(THRESHOLD_REG, "2025-01-01");
    const result = evaluateOne(DEFAULT_PROFILE, THRESHOLD_REG, v, noForce);
    const revCheck = result.dimension_explainability.find(d => d.id === "annual_revenue_usd");
    expect(revCheck.status).toBe("pass");
  });

  it("fails threshold below minimum", () => {
    const profile = { ...DEFAULT_PROFILE, annual_revenue_usd: 100 };
    const v = chooseVersion(THRESHOLD_REG, "2025-01-01");
    const result = evaluateOne(profile, THRESHOLD_REG, v, noForce);
    const revCheck = result.dimension_explainability.find(d => d.id === "annual_revenue_usd");
    expect(revCheck.status).toBe("fail");
  });

  it("fails threshold above maximum", () => {
    const profile = { ...DEFAULT_PROFILE, annual_revenue_usd: 999999999 };
    const v = chooseVersion(THRESHOLD_REG, "2025-01-01");
    const result = evaluateOne(profile, THRESHOLD_REG, v, noForce);
    const revCheck = result.dimension_explainability.find(d => d.id === "annual_revenue_usd");
    expect(revCheck.status).toBe("fail");
  });

  it("triggers exemption when criteria met", () => {
    const profile = { ...DEFAULT_PROFILE, company_size: "MICRO" };
    const v = chooseVersion(THRESHOLD_REG, "2025-01-01");
    const result = evaluateOne(profile, THRESHOLD_REG, v, noForce);
    const exemptCheck = result.dimension_explainability.find(d => d.id === "exemptions");
    expect(exemptCheck.status).toBe("fail");
    expect(result.applicable).toBe(false);
  });

  it("force-includes via branch rules", () => {
    const profile = { ...DEFAULT_PROFILE, jurisdiction: "JP", markets: ["JP"] };
    const forceCtx = { forcedCodes: new Set(["TEST_REG"]), explanations: ["Forced for test."] };
    const v = chooseVersion(SIMPLE_REG, "2025-01-01");
    const result = evaluateOne(profile, SIMPLE_REG, v, forceCtx);
    expect(result.applicable).toBe(true);
    expect(result.reason).toContain("conditional branch logic");
  });

  it("includes related_regulations in result", () => {
    const v = chooseVersion(MULTI_VERSION_REG, "2024-01-01");
    const result = evaluateOne(DEFAULT_PROFILE, MULTI_VERSION_REG, v, noForce);
    expect(result.related_regulations).toEqual(["TEST_REG"]);
  });

  it("handles missing threshold profile value as neutral", () => {
    const profile = { ...DEFAULT_PROFILE, monthly_active_users: null };
    const v = chooseVersion(THRESHOLD_REG, "2025-01-01");
    const result = evaluateOne(profile, THRESHOLD_REG, v, noForce);
    const mauCheck = result.dimension_explainability.find(d => d.id === "monthly_active_users");
    expect(mauCheck.status).toBe("neutral");
    expect(mauCheck.detail).toContain("not provided");
  });
});

// ── parseCsv ──
describe("parseCsv", () => {
  it("parses CSV into regulation objects", () => {
    const result = parseCsv(CSV_SAMPLE);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("CSV_TEST");
    expect(result[0].versions).toHaveLength(1);
    expect(result[0].versions[0].conditions.jurisdictions_any).toEqual(["EU", "UK"]);
  });
  it("returns empty for header-only CSV", () => {
    expect(parseCsv("code,name\n")).toEqual([]);
  });
  it("returns empty for empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });
  it("handles quoted fields containing commas", () => {
    const csv = [
      "code,name,authority,summary,source_url,version,effective_from,status,jurisdictions_any,markets_any,industries_any,product_types_any,company_sizes_any",
      'CSV_QUOTED,"Quoted, Regulation",CSV Auth,"Summary, with comma",https://example.com,1,2021-01-01,ACTIVE,EU,EU,TECHNOLOGY,AI_SAAS,SME'
    ].join("\n");
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Quoted, Regulation");
    expect(result[0].summary).toBe("Summary, with comma");
    expect(result[0].versions[0].conditions.product_types_any).toEqual(["AI_SAAS"]);
  });
});

// ── profileToParams / paramsToProfile round-trip ──
describe("profileToParams / paramsToProfile", () => {
  it("round-trips a profile through URL params", () => {
    const params = profileToParams(DEFAULT_PROFILE);
    const restored = paramsToProfile(params);
    expect(restored.jurisdiction).toBe(DEFAULT_PROFILE.jurisdiction);
    expect(restored.industry).toBe(DEFAULT_PROFILE.industry);
    expect(restored.company_size).toBe(DEFAULT_PROFILE.company_size);
    expect(restored.product_type).toBe(DEFAULT_PROFILE.product_type);
    expect(restored.entity_type).toBe(DEFAULT_PROFILE.entity_type);
    expect(restored.annual_revenue_usd).toBe(DEFAULT_PROFILE.annual_revenue_usd);
    expect(restored.monthly_active_users).toBe(DEFAULT_PROFILE.monthly_active_users);
    expect(restored.as_of_date).toBe(DEFAULT_PROFILE.as_of_date);
    expect(restored.markets).toEqual(DEFAULT_PROFILE.markets);
  });
  it("handles empty profile gracefully", () => {
    const params = profileToParams({ jurisdiction: "", markets: [] });
    const restored = paramsToProfile(params);
    expect(restored.jurisdiction).toBe("");
    expect(restored.markets).toEqual([]);
  });
});

// ── buildTimeline ──
describe("buildTimeline", () => {
  it("returns sorted versions with isActive flag", () => {
    const tl = buildTimeline(MULTI_VERSION_REG, "2024-01-01");
    expect(tl).toHaveLength(2);
    expect(tl[0].version).toBe(1);
    expect(tl[0].isActive).toBe(false);
    expect(tl[1].version).toBe(2);
    expect(tl[1].isActive).toBe(true);
  });
  it("shows v1 as active when date is before repeal", () => {
    const tl = buildTimeline(MULTI_VERSION_REG, "2022-01-01");
    expect(tl[0].isActive).toBe(true);
    expect(tl[1].isActive).toBe(false);
  });
});

// ── buildDependencyGraph ──
describe("buildDependencyGraph", () => {
  it("builds nodes and edges from results", () => {
    const results = [
      { code: "A", name: "Reg A", applicable: true, related_regulations: ["B"] },
      { code: "B", name: "Reg B", applicable: false, related_regulations: [] },
    ];
    const graph = buildDependencyGraph(results);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual({ from: "A", to: "B", exists: true });
  });
  it("marks non-existent targets", () => {
    const results = [
      { code: "A", name: "Reg A", applicable: true, related_regulations: ["Z"] },
    ];
    const graph = buildDependencyGraph(results);
    expect(graph.edges[0].exists).toBe(false);
  });
  it("handles empty results", () => {
    const graph = buildDependencyGraph([]);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});

// ── Constants ──
describe("OPTIONS", () => {
  it("has all required option groups", () => {
    expect(OPTIONS.jurisdictions.length).toBeGreaterThan(0);
    expect(OPTIONS.industries.length).toBeGreaterThan(0);
    expect(OPTIONS.company_sizes.length).toBeGreaterThan(0);
    expect(OPTIONS.product_types.length).toBeGreaterThan(0);
    expect(OPTIONS.entity_types.length).toBeGreaterThan(0);
  });
});

describe("BRANCH_RULES", () => {
  it("has expected structure", () => {
    expect(BRANCH_RULES.length).toBeGreaterThan(0);
    for (const rule of BRANCH_RULES) {
      expect(rule).toHaveProperty("id");
      expect(rule).toHaveProperty("when");
      expect(rule).toHaveProperty("force_include_codes");
      expect(rule).toHaveProperty("explanation");
    }
  });
});

// ── parseDate ──
describe("parseDate", () => {
  it("parses ISO date string to Date object", () => {
    const d = parseDate("2024-08-01");
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(1);
  });
});
