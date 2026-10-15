import { describe, expect, it } from "vitest";
import { CSP_DEVELOPMENT, CSP_PRODUCTION } from "../src/shared/csp";

function directives(csp: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of csp.split(";")) {
    const parts = entry.trim().split(/\s+/);
    const name = parts.shift();
    if (name) result[name] = parts.join(" ");
  }
  return result;
}

const production = directives(CSP_PRODUCTION);
const development = directives(CSP_DEVELOPMENT);

describe("production CSP", () => {
  it("allows scripts from the bundled files only — no inline, no eval", () => {
    expect(production["script-src"]).toBe("'self'");
  });

  it("keeps a packaged Astra offline: no remote origin in any directive", () => {
    for (const [name, value] of Object.entries(production)) {
      expect(value, `${name} must not reference a remote origin`).not.toMatch(/https?:\/\//);
    }
  });

  it("denies framing, plugins, form posting and base rewriting", () => {
    expect(production["frame-src"]).toBe("'none'");
    expect(production["object-src"]).toBe("'none'");
    expect(production["base-uri"]).toBe("'none'");
    expect(production["form-action"]).toBe("'none'");
  });

  it("still permits what Tailwind and Monaco need at runtime", () => {
    // Both inject <style> elements; neither can be made to use a file:// URL.
    expect(production["style-src"]).toContain("'unsafe-inline'");
    // Monaco creates its language workers from blob:/data: URLs.
    expect(production["worker-src"]).toContain("blob:");
    expect(production["worker-src"]).toContain("data:");
  });
});

describe("development CSP", () => {
  it("permits the inline script Vite's React Fast Refresh preamble needs", () => {
    expect(development["script-src"]).toContain("'unsafe-inline'");
  });

  it("permits the HMR websocket and the dev server origin", () => {
    expect(development["connect-src"]).toContain("ws://localhost:*");
    expect(development["connect-src"]).toContain("http://localhost:*");
  });

  it("holds the same structural denials as production", () => {
    expect(development["frame-src"]).toBe("'none'");
    expect(development["object-src"]).toBe("'none'");
    expect(development["base-uri"]).toBe("'none'");
    expect(development["form-action"]).toBe("'none'");
  });
});

describe("both policies", () => {
  it("names every directive, so nothing silently falls back to a browser default", () => {
    for (const policy of [production, development]) {
      expect(policy["default-src"]).toBe("'self'");
      expect(Object.keys(policy).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("differs only where development genuinely has to", () => {
    const shared = Object.keys(production).filter((key) => production[key] === development[key]);

    // The relaxations that must NOT exist in a shipped build.
    expect(shared).not.toContain("script-src");
    expect(shared).not.toContain("connect-src");

    // The denials that must survive into development, so a dev build cannot
    // quietly behave more permissively than the thing being shipped.
    expect(shared).toContain("default-src");
    expect(shared).toContain("object-src");
    expect(shared).toContain("frame-src");
    expect(shared).toContain("base-uri");
    expect(shared).toContain("form-action");
  });

  it("declares the same set of directives in both, so nothing is dropped by mode", () => {
    expect(Object.keys(production).sort()).toEqual(Object.keys(development).sort());
  });
});
