import { create } from "zustand";
import { bridge } from "./bridge";
import { MENU_COMMANDS, type MenuCommand } from "../../../shared/ipc";
import { DEFAULT_SETTINGS, type AstraSettings } from "../../../shared/settings";

/**
 * The renderer's view state.
 *
 * Two things live here: the user's settings (mirrored from the main process,
 * which owns the file) and the shell's own shape — which panels are visible, the
 * active viewport preset, and whether the canvas is in edit or preview mode.
 *
 * The shell state is renderer-owned on purpose. The application menu is built in
 * the main process, but it never keeps a copy of this state: a menu click arrives
 * as a `MenuCommand` and is applied here. That keeps one source of truth for
 * "is the sidebar showing" instead of two that can disagree.
 */

export type ViewportPreset = "desktop" | "tablet" | "mobile";
export type PanelId = "sidebar" | "inspector" | "editor";
export type EditorMode = "edit" | "preview";

/** Canvas widths for each preset; Desktop is fluid (FR-H01). */
export const VIEWPORT_WIDTHS: Record<ViewportPreset, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

export interface AppState {
  readonly settings: AstraSettings;
  readonly settingsOpen: boolean;
  readonly panels: Record<PanelId, boolean>;
  readonly viewport: ViewportPreset;
  readonly mode: EditorMode;

  /** Loads settings from the main process. A no-op without a bridge. */
  hydrate: () => Promise<void>;
  /** Subscribes to menu commands. Returns an unsubscribe function. */
  subscribeToMenu: () => () => void;

  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (patch: Partial<AstraSettings>) => Promise<void>;

  setViewport: (viewport: ViewportPreset) => void;
  togglePanel: (panel: PanelId) => void;
  togglePreview: () => void;

  /** Applies a command forwarded from the application menu. */
  runCommand: (command: MenuCommand) => void;
}

/**
 * Reflects settings onto the document so CSS can react.
 *
 * The theme is written as `data-theme` and resolved entirely in CSS (a `system`
 * value lets a `prefers-color-scheme` rule decide), so no colour logic lives in
 * JavaScript. The font size becomes a custom property the monospaced surfaces
 * read.
 */
export function applySettingsToDom(settings: AstraSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["theme"] = settings.theme;
  root.style.setProperty("--astra-font-mono-size", `${settings.fontSize}px`);
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,
  panels: { sidebar: true, inspector: true, editor: true },
  viewport: "desktop",
  mode: "edit",

  hydrate: async () => {
    const api = bridge();
    if (!api?.getSettings) return;
    try {
      const settings = await api.getSettings();
      applySettingsToDom(settings);
      set({ settings });
    } catch {
      // The bridge exists but answered with an error: keep the defaults rather
      // than block the shell. The status bar still reports the bridge state.
    }
  },

  subscribeToMenu: () => {
    const api = bridge();
    if (!api?.onMenuCommand) return () => undefined;
    return api.onMenuCommand((command) => get().runCommand(command));
  },

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  updateSettings: async (patch) => {
    const api = bridge();
    const merged: AstraSettings = { ...get().settings, ...patch };

    if (!api?.updateSettings) {
      // No bridge (a plain browser against the dev server): apply locally so the
      // settings surface is still usable, just not persisted.
      applySettingsToDom(merged);
      set({ settings: merged });
      return;
    }

    try {
      const saved = await api.updateSettings(patch);
      applySettingsToDom(saved);
      set({ settings: saved });
    } catch {
      // The main process rejected the update; leave the stored value untouched.
    }
  },

  setViewport: (viewport) => set({ viewport }),
  togglePanel: (panel) => set((state) => ({ panels: { ...state.panels, [panel]: !state.panels[panel] } })),
  togglePreview: () => set((state) => ({ mode: state.mode === "edit" ? "preview" : "edit" })),

  runCommand: (command) => {
    switch (command) {
      case MENU_COMMANDS.openSettings:
        get().openSettings();
        return;
      case MENU_COMMANDS.toggleSidebar:
        get().togglePanel("sidebar");
        return;
      case MENU_COMMANDS.toggleInspector:
        get().togglePanel("inspector");
        return;
      case MENU_COMMANDS.toggleEditor:
        get().togglePanel("editor");
        return;
      case MENU_COMMANDS.togglePreview:
        get().togglePreview();
        return;
      case MENU_COMMANDS.viewportDesktop:
        get().setViewport("desktop");
        return;
      case MENU_COMMANDS.viewportTablet:
        get().setViewport("tablet");
        return;
      case MENU_COMMANDS.viewportMobile:
        get().setViewport("mobile");
        return;
      default:
        return;
    }
  },
}));
