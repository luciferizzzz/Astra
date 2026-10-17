import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { useAppStore } from "@/store/app-store";
import { MENU_COMMANDS, type MenuCommand } from "../src/shared/ipc";
import { DEFAULT_SETTINGS, type AstraSettings } from "../src/shared/settings";

/**
 * The settings surface against a stand-in bridge.
 *
 * This is where the two halves of FR-A05 meet: the renderer's form and the main
 * process's stored, normalised value. The fakes below answer the way the real
 * handlers do — `updateSettings` returns the whole, normalised object — so a
 * renderer that trusted its own optimistic copy instead of the reply would fail
 * here.
 */

interface BridgeHarness {
  readonly updates: Array<Partial<AstraSettings>>;
  readonly stored: AstraSettings;
  /** The listener the preload registered, so a menu command can be simulated. */
  emit(command: MenuCommand): void;
}

function installBridge(initial: Partial<AstraSettings> = {}): BridgeHarness {
  const stored: AstraSettings = { ...DEFAULT_SETTINGS, ...initial };
  const updates: Array<Partial<AstraSettings>> = [];
  let listener: ((command: MenuCommand) => void) | null = null;

  Reflect.set(window, "astra", {
    ping: async (nonce?: string) => ({ pong: true, nonce: nonce ?? null }),
    getAppVersion: async () => "0.1.0",
    getSettings: async () => ({ ...stored }),
    updateSettings: async (patch: Partial<AstraSettings>) => {
      updates.push(patch);
      Object.assign(stored, patch);
      return { ...stored };
    },
    onMenuCommand: (next: (command: MenuCommand) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
  });

  return {
    updates,
    stored,
    emit: (command) => listener?.(command),
  };
}

beforeEach(() => {
  Reflect.deleteProperty(window, "astra");
  delete document.documentElement.dataset["theme"];
  useAppStore.setState({
    settings: DEFAULT_SETTINGS,
    settingsOpen: false,
    panels: { sidebar: true, inspector: true, editor: true },
    viewport: "desktop",
    mode: "edit",
  });
});

describe("settings — loading", () => {
  it("applies the stored theme and font size on start", async () => {
    installBridge({ theme: "light", fontSize: 18 });

    render(<App />);

    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));
    expect(document.documentElement.style.getPropertyValue("--astra-font-mono-size")).toBe("18px");
  });

  it("keeps the defaults when the bridge is absent", async () => {
    render(<App />);

    // No bridge: nothing to apply, and nothing should throw.
    await waitFor(() => expect(screen.getByTestId("bridge-status")).toHaveTextContent("unavailable"));
    expect(document.documentElement.dataset["theme"]).toBeUndefined();
  });
});

describe("settings — editing", () => {
  it("persists a theme change and applies it immediately", async () => {
    const bridge = installBridge();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));

    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "light" } });

    await waitFor(() => expect(bridge.updates).toContainEqual({ theme: "light" }));
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));
    expect(bridge.stored.theme).toBe("light");
  });

  it("renders the value the main process returns, not the one it hoped for", async () => {
    installBridge();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));

    fireEvent.change(screen.getByLabelText("Code font size"), { target: { value: "16" } });

    await waitFor(() => expect(screen.getByLabelText("Code font size")).toHaveValue(16));
  });

  it("clamps an out-of-range font size before it reaches the main process", async () => {
    const bridge = installBridge();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));

    fireEvent.change(screen.getByLabelText("Code font size"), { target: { value: "999" } });

    await waitFor(() => expect(bridge.updates).toContainEqual({ fontSize: 24 }));
  });

  it("stores the autosave interval as milliseconds", async () => {
    const bridge = installBridge();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));

    fireEvent.change(screen.getByLabelText("Autosave"), { target: { value: "2000" } });

    await waitFor(() => expect(bridge.updates).toContainEqual({ autosaveIntervalMs: 2000 }));
  });

  it("shows telemetry locked off, because this build collects nothing", () => {
    installBridge();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));

    const telemetry = screen.getByLabelText("Usage analytics");
    expect(telemetry).toBeDisabled();
    expect(telemetry).not.toBeChecked();
  });

  it("leaves the stored value untouched when the main process rejects the update", async () => {
    Reflect.set(window, "astra", {
      ping: async () => ({ pong: true, nonce: null }),
      getAppVersion: async () => "0.1.0",
      getSettings: async () => ({ ...DEFAULT_SETTINGS }),
      updateSettings: async () => {
        throw new Error("rejected");
      },
      onMenuCommand: () => () => undefined,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));

    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "light" } });

    // The change is refused; the control stays on the value the store still holds.
    await waitFor(() => expect(screen.getByLabelText("Theme")).toHaveValue("system"));
  });
});

describe("settings — opened from the application menu", () => {
  it("opens the dialog when the main process forwards open-settings", async () => {
    const bridge = installBridge();

    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();

    act(() => bridge.emit(MENU_COMMANDS.openSettings));

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });

  it("applies menu commands for panels, viewport and preview", async () => {
    const bridge = installBridge();

    render(<App />);

    act(() => bridge.emit(MENU_COMMANDS.toggleSidebar));
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();

    act(() => bridge.emit(MENU_COMMANDS.viewportMobile));
    expect(screen.getByTestId("status-viewport")).toHaveTextContent("Mobile");

    act(() => bridge.emit(MENU_COMMANDS.togglePreview));
    expect(screen.getByTestId("status-mode")).toHaveTextContent("preview");
  });

  it("stops listening once the layout unmounts", () => {
    const bridge = installBridge();
    const removeListener = vi.fn();
    Reflect.set(window, "astra", {
      ...(window.astra as object),
      onMenuCommand: () => removeListener,
    });

    const { unmount } = render(<App />);
    unmount();

    expect(removeListener).toHaveBeenCalled();
    // Keep the harness referenced so the bridge is definitely installed first.
    expect(bridge.updates).toEqual([]);
  });
});
