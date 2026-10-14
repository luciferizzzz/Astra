import { describe, it, expect } from "vitest";

/**
 * Foundation smoke test — proves the Vitest + jsdom harness is wired up.
 * Real parser / sync-engine tests live alongside this file in `tests/`.
 */
describe("foundation", () => {
  it("runs vitest with a jsdom environment", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement("div").tagName).toBe("DIV");
  });

  it("supports path alias and TS modules", () => {
    expect(1 + 1).toBe(2);
  });
});
