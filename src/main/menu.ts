/**
 * The application menu template.
 *
 * The template is built here as plain data, with no runtime dependency on
 * `electron`, so its shape, its accelerators and the disabled/enabled verdicts
 * for every item can be unit-tested. The entry point (`src/main/index.ts`) is
 * what actually hands it to `Menu.buildFromTemplate`.
 *
 * The guiding rule is the same one the toolbar follows: an item whose feature
 * does not exist yet is rendered **disabled**, not hidden. A menu that silently
 * omits "Open Project" reads as a build that cannot open projects; a greyed-out
 * item reads as a build that will. Only the items that genuinely work today are
 * enabled — Settings, Exit, About, the viewport presets, the panel toggles and
 * the preview toggle. See PRD §9.3 and FR-A02.
 */

import type { MenuItemConstructorOptions } from "electron";
import { MENU_COMMANDS, type MenuCommand } from "../shared/ipc";

export interface MenuHandlers {
  /** Open the renderer's settings surface. */
  onOpenSettings: () => void;
  /** Show the About dialog. */
  onAbout: () => void;
  /** Forward a renderer-owned command (panels, viewport, preview). */
  onCommand: (command: MenuCommand) => void;
}

export interface MenuBuildOptions {
  readonly handlers: MenuHandlers;
  /** Adds Reload and Developer Tools. Never true in a packaged build. */
  readonly isDevelopment: boolean;
  /** Defaults to the running platform; overridable so tests can pin it. */
  readonly platform?: NodeJS.Platform;
}

/**
 * A greyed-out item that documents a feature on the roadmap.
 *
 * `accelerator` is still declared so the shortcut appears next to the label:
 * seeing `Ctrl+S` on a disabled "Save" tells the user the action exists and is
 * coming, which is truer than an empty menu.
 */
function comingSoon(label: string, accelerator?: string): MenuItemConstructorOptions {
  return accelerator ? { label, accelerator, enabled: false } : { label, enabled: false };
}

export function buildMenuTemplate(options: MenuBuildOptions): MenuItemConstructorOptions[] {
  const { handlers, isDevelopment } = options;
  const platform = options.platform ?? process.platform;

  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      comingSoon("New File"),
      comingSoon("Open Project…", "CmdOrCtrl+O"),
      comingSoon("Close Project"),
      { type: "separator" },
      comingSoon("Save", "CmdOrCtrl+S"),
      comingSoon("Save All", "CmdOrCtrl+Shift+S"),
      { type: "separator" },
      {
        label: "Settings…",
        accelerator: "CmdOrCtrl+,",
        click: () => handlers.onOpenSettings(),
      },
      { type: "separator" },
      // The OS already offers this; keeping it here matches FR-A02 and gives a
      // menu path for users who expect one.
      { label: "Exit", role: "quit" },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      comingSoon("Undo", "CmdOrCtrl+Z"),
      comingSoon("Redo", "CmdOrCtrl+Shift+Z"),
      { type: "separator" },
      comingSoon("Find…", "CmdOrCtrl+F"),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      {
        label: "Desktop",
        accelerator: "CmdOrCtrl+1",
        click: () => handlers.onCommand(MENU_COMMANDS.viewportDesktop),
      },
      {
        label: "Tablet",
        accelerator: "CmdOrCtrl+2",
        click: () => handlers.onCommand(MENU_COMMANDS.viewportTablet),
      },
      {
        label: "Mobile",
        accelerator: "CmdOrCtrl+3",
        click: () => handlers.onCommand(MENU_COMMANDS.viewportMobile),
      },
      { type: "separator" },
      // Canvas zoom needs a rendered canvas; it arrives with Phase 2.
      comingSoon("Zoom to Fit"),
      comingSoon("Actual Size", "CmdOrCtrl+0"),
      comingSoon("Zoom In", "CmdOrCtrl+Plus"),
      comingSoon("Zoom Out", "CmdOrCtrl+-"),
      { type: "separator" },
      {
        label: "Toggle Sidebar",
        click: () => handlers.onCommand(MENU_COMMANDS.toggleSidebar),
      },
      {
        label: "Toggle Inspector",
        click: () => handlers.onCommand(MENU_COMMANDS.toggleInspector),
      },
      {
        label: "Toggle Code Editor",
        click: () => handlers.onCommand(MENU_COMMANDS.toggleEditor),
      },
      { type: "separator" },
      {
        label: "Toggle Preview",
        accelerator: "CmdOrCtrl+P",
        click: () => handlers.onCommand(MENU_COMMANDS.togglePreview),
      },
      ...(isDevelopment
        ? ([
            { type: "separator" },
            { label: "Reload", role: "reload" },
            { label: "Toggle Developer Tools", role: "toggleDevTools" },
          ] satisfies MenuItemConstructorOptions[])
        : []),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: "Help",
    submenu: [
      {
        label: "About Astra",
        click: () => handlers.onAbout(),
      },
    ],
  };

  // macOS puts an application menu first; the same handlers appear there.
  const appMenu: MenuItemConstructorOptions = {
    label: "Astra",
    submenu: [
      { label: "About Astra", role: "about" },
      { type: "separator" },
      {
        label: "Settings…",
        accelerator: "CmdOrCtrl+,",
        click: () => handlers.onOpenSettings(),
      },
      { type: "separator" },
      { label: "Quit Astra", role: "quit" },
    ],
  };

  return platform === "darwin"
    ? [appMenu, fileMenu, editMenu, viewMenu, helpMenu]
    : [fileMenu, editMenu, viewMenu, helpMenu];
}
