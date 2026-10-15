import { describe, expect, it } from "vitest";
import { IPC_CHANNELS } from "../src/shared/ipc";
import { CSP_PRODUCTION } from "../src/shared/csp";

/**
 * Foundation smoke test. Proves the Vitest harness, the jsdom environment and
 * the modules shared across all three processes are reachable from a test.
 * Parser / sync-engine tests will live alongside this file once Phase 0 starts.
 */
describe("foundation", () => {
  it("runs vitest with a jsdom environment", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement("div").tagName).toBe("DIV");
  });

  it("keeps every IPC channel unique and namespaced", () => {
    const channels = Object.values(IPC_CHANNELS);

    expect(new Set(channels).size).toBe(channels.length);
    for (const channel of channels) {
      expect(channel).toMatch(/^astra:/);
    }
  });

  it("ships a production CSP that forbids inline scripts", () => {
    expect(CSP_PRODUCTION).toContain("script-src 'self'");
    expect(CSP_PRODUCTION).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
