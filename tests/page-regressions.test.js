import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const read = (file) => readFileSync(file, "utf8");

describe("page regression checks", () => {
  it("dashboard heatmap reads engine check ids", () => {
    const dashboard = read("./dashboard.html");
    expect(dashboard).toContain("dims.indexOf(d.id)");
    expect(dashboard).not.toContain("dims.indexOf(d.dimension)");
  });

  it("jurisdiction comparison preserves the base served markets", () => {
    const compare = read("./compare.html");
    expect(compare).toContain("markets: Array.from(new Set([...(baseProfile.markets || []), jurCode]))");
    expect(compare).not.toContain("markets: [jurCode]");
  });

  it("main evaluator does not render inline event handlers", () => {
    const index = read("./index.html");
    expect(index).not.toContain("onclick=");
    expect(index).toContain("bindResultCardActions");
  });
});
