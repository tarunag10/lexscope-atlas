import { describe, expect, it } from "vitest";
import { escapeHtml } from "../shared.js";

describe("escapeHtml", () => {
  it("escapes HTML control characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
  });

  it("handles nullish values as empty strings", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
