import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { buildMenuTemplate } from "../src/main/menu";
import { MENU_COMMANDS, type MenuCommand } from "../src/shared/ipc";

/**
 * The menu template is built as plain data precisely so its shape can be pinned
 * here, without an Electron process. The interesting behaviour is the split
 * between what is live and what is a placeholder: the acceptance criterion is
 * "each item triggers the corresponding action or is disabled when unavailable",
 * so both halves are asserted.
 */

function handlers() {
  // Returned without a `MenuHandlers` annotation on purpose: that would widen
  // the `vi.fn()` mocks back to plain functions and hide `.mock` from the tests.
  return {
    onOpenSettings: vi.fn(),
    onAbout: vi.fn(),
    onCommand: vi.fn<(command: MenuCommand) => void>(),
  };
}

function menu(options: Parameters<typeof buildMenuTemplate>[0]) {
  return buildMenuTemplate(options);
}

function topLevel(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions {
  const found = items.find((item) => item.label === label);
  if (!found) throw new Error(`no top-level menu labelled "${label}"`);
  return found;
}

function submenuOf(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const menu = topLevel(items, label);
  if (!Array.isArray(menu.submenu)) throw new Error(`"${label}" has no array submenu`);
  return menu.submenu;
}

function itemNamed(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions {
  const found = items.find((item) => item.label === label);
  if (!found) throw new Error(`no item labelled "${label}"`);
  return found;
}

function click(item: MenuItemConstructorOptions): void {
  // Electron passes (menuItem, window, event); the handlers here ignore them.
  (item.click as (() => void) | undefined)?.();
}

describe("buildMenuTemplate — structure", () => {
  it("exposes File, Edit, View and Help on Windows", () => {
    const labels = menu({ handlers: handlers(), isDevelopment: false, platform: "win32" }).map(
      (item) => item.label,
    );
    expect(labels).toEqual(["File", "Edit", "View", "Help"]);
  });

  it("prepends the application menu on macOS", () => {
    const labels = menu({ handlers: handlers(), isDevelopment: false, platform: "darwin" }).map(
      (item) => item.label,
    );
    expect(labels).toEqual(["Astra", "File", "Edit", "View", "Help"]);
  });
});

describe("buildMenuTemplate — File", () => {
  const file = () => submenuOf(menu({ handlers: handlers(), isDevelopment: false }), "File");

  it("lists the required entries in the order the spec names them", () => {
    const labels = file()
      .filter((item) => item.type !== "separator")
      .map((item) => item.label);
    expect(labels).toEqual([
      "New File",
      "Open Project…",
      "Close Project",
      "Save",
      "Save All",
      "Settings…",
      "Exit",
    ]);
  });

  it("disables the project and save actions until those features exist", () => {
    expect(itemNamed(file(), "Open Project…").enabled).toBe(false);
    expect(itemNamed(file(), "Save").enabled).toBe(false);
    expect(itemNamed(file(), "Save All").enabled).toBe(false);
  });

  it("leaves Settings enabled and wires it to the handler", () => {
    const spy = handlers();
    const settings = itemNamed(submenuOf(menu({ handlers: spy, isDevelopment: false }), "File"), "Settings…");

    expect(settings.enabled).not.toBe(false);
    expect(settings.accelerator).toBe("CmdOrCtrl+,");
    click(settings);
    expect(spy.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("gives Exit the quit role so the operating system owns it", () => {
    expect(itemNamed(file(), "Exit").role).toBe("quit");
  });
});

describe("buildMenuTemplate — Edit", () => {
  it("keeps Undo, Redo and Find disabled until the editor exists", () => {
    const edit = submenuOf(menu({ handlers: handlers(), isDevelopment: false }), "Edit");
    for (const label of ["Undo", "Redo", "Find…"]) {
      expect(itemNamed(edit, label).enabled).toBe(false);
    }
  });
});

describe("buildMenuTemplate — View", () => {
  const view = (isDevelopment = false) =>
    submenuOf(menu({ handlers: handlers(), isDevelopment }), "View");

  it("routes the viewport presets through the command handler", () => {
    const spy = handlers();
    const items = submenuOf(menu({ handlers: spy, isDevelopment: false }), "View");

    click(itemNamed(items, "Desktop"));
    click(itemNamed(items, "Tablet"));
    click(itemNamed(items, "Mobile"));

    expect(spy.onCommand.mock.calls.map(([command]) => command)).toEqual([
      MENU_COMMANDS.viewportDesktop,
      MENU_COMMANDS.viewportTablet,
      MENU_COMMANDS.viewportMobile,
    ]);
  });

  it("binds the documented viewport accelerators", () => {
    const items = view();
    expect(itemNamed(items, "Desktop").accelerator).toBe("CmdOrCtrl+1");
    expect(itemNamed(items, "Tablet").accelerator).toBe("CmdOrCtrl+2");
    expect(itemNamed(items, "Mobile").accelerator).toBe("CmdOrCtrl+3");
  });

  it("toggles each panel through the command handler", () => {
    const spy = handlers();
    const items = submenuOf(menu({ handlers: spy, isDevelopment: false }), "View");

    click(itemNamed(items, "Toggle Sidebar"));
    click(itemNamed(items, "Toggle Inspector"));
    click(itemNamed(items, "Toggle Code Editor"));

    expect(spy.onCommand.mock.calls.map(([command]) => command)).toEqual([
      MENU_COMMANDS.toggleSidebar,
      MENU_COMMANDS.toggleInspector,
      MENU_COMMANDS.toggleEditor,
    ]);
  });

  it("toggles the preview with Ctrl+P", () => {
    const spy = handlers();
    const items = submenuOf(menu({ handlers: spy, isDevelopment: false }), "View");
    const preview = itemNamed(items, "Toggle Preview");

    expect(preview.accelerator).toBe("CmdOrCtrl+P");
    click(preview);
    expect(spy.onCommand).toHaveBeenCalledWith(MENU_COMMANDS.togglePreview);
  });

  it("keeps zoom disabled until the canvas renders", () => {
    const items = view();
    expect(itemNamed(items, "Zoom In").enabled).toBe(false);
    expect(itemNamed(items, "Actual Size").enabled).toBe(false);
  });

  it("only offers Reload and Developer Tools in development", () => {
    expect(view(false).some((item) => item.role === "toggleDevTools")).toBe(false);
    expect(view(true).some((item) => item.role === "toggleDevTools")).toBe(true);
  });
});

describe("buildMenuTemplate — Help", () => {
  it("opens the About dialog", () => {
    const spy = handlers();
    const help = submenuOf(menu({ handlers: spy, isDevelopment: false }), "Help");

    click(itemNamed(help, "About Astra"));
    expect(spy.onAbout).toHaveBeenCalledTimes(1);
  });
});
