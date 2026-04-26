import { describe, expect, it } from "vitest";
import { escapeHtml, safeUrl } from "../shared.js";

describe("escapeHtml", () => {
  it("escapes HTML control characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
  });

  it("handles nullish values as empty strings", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("safeUrl", () => {
  it("allows http and https URLs", () => {
    expect(safeUrl("https://example.com/reg")).toBe("https://example.com/reg");
    expect(safeUrl("http://example.com/reg")).toBe("http://example.com/reg");
  });

  it("blocks script and data URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("allows same-origin relative URLs", () => {
    expect(safeUrl("settings.html")).toBe("settings.html");
    expect(safeUrl("./data/regulations.seed.json")).toBe("./data/regulations.seed.json");
  });
});
