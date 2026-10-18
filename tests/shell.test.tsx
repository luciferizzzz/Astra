import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { useAppStore } from "@/store/app-store";
import { useProjectStore } from "@/store/project-store";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

/**
 * The Phase 1 shell: the regions exist, are named for assistive tech, and the
 * behaviour that is real — the sidebar's section switch, the viewport presets,
 * the preview toggle and the settings dialog — works.
 *
 * The store is a module singleton, so each test starts from a known shell shape;
 * otherwise a viewport chosen in one test would leak into the next.
 */
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
  useProjectStore.setState({
    root: null,
    name: null,
    entriesByDirectory: {},
    expanded: {},
    selectedPath: null,
    openFile: null,
    entryPoint: null,
    fileIssue: null,
    notice: null,
    opening: false,
    error: null,
  } as any);
});

describe("App shell", () => {
  it("renders every editor region", () => {
    render(<App />);

    expect(screen.getByRole("banner", { name: "Toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Canvas" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Code editor" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "Status bar" })).toBeInTheDocument();
  });

  it("brands the toolbar with the Astra logo and title", () => {
    const { container } = render(<App />);

    expect(screen.getByRole("heading", { name: "Astra" })).toBeInTheDocument();
    expect(container.querySelector("header img")).not.toBeNull();
  });

  it("keeps the controls whose features do not exist yet inert", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /open a project folder/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /undo the last change/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /redo the last undone change/i })).toBeDisabled();
  });

  it("enables the controls that do work today", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /preview at tablet width/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /toggle the preview/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /open application settings/i })).toBeEnabled();
  });

  it("switches sidebar sections and names each empty state", () => {
    render(<App />);

    expect(screen.getByText(/open a project folder to see its files here/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Components" }));
    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/saved components will be listed here/i)).toBeInTheDocument();
  });

  it("summarises settings in the sidebar instead of duplicating the form", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open settings/i })).toBeInTheDocument();
  });

  it("prompts for a selection in the inspector and a file in the editor", () => {
    render(<App />);

    expect(screen.getByText(/select an element on the canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/open a file to edit its source/i)).toBeInTheDocument();
    expect(screen.getByText(/open a project folder to begin/i)).toBeInTheDocument();
  });
});

describe("App shell — viewport and preview", () => {
  it("sizes and labels the canvas from the active viewport preset", () => {
    render(<App />);

    expect(screen.getByTestId("canvas-viewport")).toHaveTextContent("Desktop");

    fireEvent.click(screen.getByRole("button", { name: /preview at tablet width/i }));

    expect(screen.getByTestId("canvas-viewport")).toHaveTextContent("Tablet");
    expect(screen.getByTestId("status-viewport")).toHaveTextContent("Tablet · 768px");
    expect(screen.getByRole("button", { name: /preview at tablet width/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggles the canvas between edit and preview mode", () => {
    render(<App />);

    expect(screen.getByTestId("canvas-mode")).toHaveTextContent("edit");

    fireEvent.click(screen.getByRole("button", { name: /toggle the preview/i }));

    expect(screen.getByTestId("canvas-mode")).toHaveTextContent("preview");
    expect(screen.getByTestId("status-mode")).toHaveTextContent("preview");
  });
});

describe("App shell — entry point", () => {
  it("shows the entry page and opens it when clicked", async () => {
    const read = vi.fn().mockResolvedValue({
      relativePath: "index.html",
      text: "<!doctype html><title>Home</title>",
      hash: "d".repeat(64),
    });
    Reflect.set(window, "astra", {
      ping: async () => ({ pong: true, nonce: "renderer-ready" }),
      getAppVersion: async () => "0.1.0",
      pickProjectFolder: async () => "C:\\Projects\\site",
      projectOpen: async () => ({
        root: "C:\\Projects\\site",
        entries: [{ name: "index.html", relativePath: "index.html", kind: "file" }],
      }),
      projectReadFile: read,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open a project folder/i }));

    const entry = await screen.findByTestId("entry-point");
    expect(entry).toHaveTextContent("Entry: index.html");

    fireEvent.click(entry);
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledWith("index.html");
    });
    expect(screen.getByText(/<title>Home<\/title>/)).toBeInTheDocument();
  });

  it("says so honestly when the project has no entry page", async () => {
    Reflect.set(window, "astra", {
      ping: async () => ({ pong: true, nonce: "renderer-ready" }),
      getAppVersion: async () => "0.1.0",
      pickProjectFolder: async () => "C:\\Projects\\plain",
      projectOpen: async () => ({
        root: "C:\\Projects\\plain",
        entries: [{ name: "about.html", relativePath: "about.html", kind: "file" }],
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /open a project folder/i }));

    expect(await screen.findByTestId("no-entry-point")).toHaveTextContent("No entry page");
  });
});

describe("App shell — settings dialog", () => {
  it("opens from the toolbar and closes from a button", () => {
    render(<App />);

    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close settings/i }));
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  });

  it("closes on Escape", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  });

  it("closes when the backdrop is clicked but not when the dialog is", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open application settings/i }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });

    fireEvent.mouseDown(dialog);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();

    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  });
});
