import { describe, expect, it } from "vitest";
import { PREVIEW_PARTITION, previewWebPreferences } from "../src/main/preview-posture";

describe("previewWebPreferences", () => {
  it("puts the preview in its own in-memory partition", () => {
    expect(previewWebPreferences().partition).toBe(PREVIEW_PARTITION);
    expect(PREVIEW_PARTITION.startsWith("persist:")).toBe(false);
  });

  it("gives the preview no Node.js surface", () => {
    const preferences = previewWebPreferences();
    expect(preferences.sandbox).toBe(true);
    expect(preferences.contextIsolation).toBe(true);
    expect(preferences.nodeIntegration).toBe(false);
    expect(preferences.nodeIntegrationInSubFrames).toBe(false);
    expect(preferences.nodeIntegrationInWorker).toBe(false);
  });

  it("gives the preview no Astra bridge into the main process", () => {
    // Phase 2 uses a minimal preload only to report click coordinates for
    // hit-testing (Option C). It must not expose the Astra API or Node.
    const prefs = previewWebPreferences();
    expect(prefs.preload).toBeDefined();
    expect(prefs.sandbox).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
  });

  it("closes the remaining escape hatches", () => {
    const preferences = previewWebPreferences();
    expect(preferences.webSecurity).toBe(true);
    expect(preferences.allowRunningInsecureContent).toBe(false);
    expect(preferences.experimentalFeatures).toBe(false);
    expect(preferences.webviewTag).toBe(false);
    expect(preferences.devTools).toBe(false);
    expect(preferences.navigateOnDragDrop).toBe(false);
  });
});
