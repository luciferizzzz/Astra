import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROOT_DIRECTORY, useProjectStore, applyProjectTitle } from "../src/renderer/src/store/project-store";
import { useAppStore } from "../src/renderer/src/store/app-store";
import { MENU_COMMANDS } from "../src/shared/ipc";
import type { AstraApi } from "../src/preload/api";

interface BridgeStub {
  api: Partial<AstraApi>;
  events: ((changes: readonly any[]) => void)[];
}

function installBridge(stub: Partial<AstraApi> = {}): BridgeStub {
  const events: ((changes: readonly any[]) => void)[] = [];
  const api: Partial<AstraApi> = {
    ping: async () => ({ pong: true, nonce: null }),
    getAppVersion: async () => "0.1.0",
    getSettings: async () => ({} as any),
    updateSettings: async (patch: any) => ({ ...patch } as any),
    onMenuCommand: () => () => undefined,
    getProjectState: async () => ({ root: null }),
    pickProjectFolder: async () => null,
    projectOpen: async () => ({ root: "", entries: [] }),
    projectClose: async () => ({ root: null }),
    projectList: async () => [],
    projectReadFile: async () => ({ relativePath: "file.txt", text: "", hash: "0".repeat(64) }),
    projectWriteFile: async (_rel: string, _text: string, _hash?: string | undefined) => ({ relativePath: _rel, success: true, hash: "0".repeat(64), bytes: _text.length }),
    onProjectFsEvent: (listener) => {
      events.push(listener as any);
      return () => {
        const idx = events.indexOf(listener as any);
        if (idx >= 0) events.splice(idx, 1);
      };
    },
    ...stub,
  };
  Reflect.set(window, "astra", api as AstraApi);
  return { api, events };
}

beforeEach(() => {
  Reflect.deleteProperty(window, "astra");
  if (typeof document !== "undefined") document.title = "Astra";
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
  useAppStore.setState({
    settings: useAppStore.getState().settings,
    settingsOpen: false,
    panels: { sidebar: true, inspector: true, editor: true },
    viewport: "desktop",
    mode: "edit",
  } as any);
});

describe("project-store", () => {
  it("hydrates from getProjectState and loads root entries", async () => {
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\mysite" }),
      projectList: vi.fn().mockResolvedValue([
        { name: "index.html", relativePath: "index.html", kind: "file" },
        { name: "css", relativePath: "css", kind: "directory" },
      ]),
    });

    await useProjectStore.getState().hydrate();
    const state = useProjectStore.getState();
    expect(state.root).toBe("C:\\Projects\\mysite");
    expect(state.name).toBe("mysite");
    expect(state.entriesByDirectory[ROOT_DIRECTORY]).toHaveLength(2);
    expect(document.title).toBe("mysite — Astra");
  });

  it("does nothing on cancelled pick", async () => {
    installBridge({ pickProjectFolder: async () => null });
    await useProjectStore.getState().openProject();
    const state = useProjectStore.getState();
    expect(state.root).toBe(null);
    expect(state.name).toBe(null);
  });

  it("opens a project when a folder is picked", async () => {
    installBridge({
      pickProjectFolder: async () => "C:\\Projects\\demo",
      projectOpen: vi.fn().mockResolvedValue({
        root: "C:\\Projects\\demo",
        entries: [
          { name: "index.html", relativePath: "index.html", kind: "file" },
          { name: "assets", relativePath: "assets", kind: "directory" },
        ],
      }),
    });

    await useProjectStore.getState().openProject();
    const state = useProjectStore.getState();
    expect(state.root).toBe("C:\\Projects\\demo");
    expect(state.name).toBe("demo");
    expect(state.entriesByDirectory[ROOT_DIRECTORY]).toHaveLength(2);
    expect(state.entryPoint).toBe("index.html");
    expect(document.title).toBe("demo — Astra");
  });

  it("reports no entry point for a project without index.html", async () => {
    installBridge({
      pickProjectFolder: async () => "C:\\Projects\\plain",
      projectOpen: vi.fn().mockResolvedValue({
        root: "C:\\Projects\\plain",
        entries: [{ name: "about.html", relativePath: "about.html", kind: "file" }],
      }),
    });

    await useProjectStore.getState().openProject();
    expect(useProjectStore.getState().entryPoint).toBe(null);
  });

  it("keeps the entry point fresh when the watcher reports it created or deleted", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce([{ name: "about.html", relativePath: "about.html", kind: "file" }])
      .mockResolvedValueOnce([
        { name: "about.html", relativePath: "about.html", kind: "file" },
        { name: "index.html", relativePath: "index.html", kind: "file" },
      ])
      .mockResolvedValueOnce([{ name: "about.html", relativePath: "about.html", kind: "file" }]);
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\x" }),
      projectList: list,
    });

    await useProjectStore.getState().hydrate();
    expect(useProjectStore.getState().entryPoint).toBe(null);

    // The watcher saw index.html appear at the root.
    await useProjectStore.getState().applyFsChanges([
      { type: "created", relativePath: "index.html", kind: "file" },
    ]);
    expect(useProjectStore.getState().entryPoint).toBe("index.html");

    // …and then disappear.
    await useProjectStore.getState().applyFsChanges([
      { type: "deleted", relativePath: "index.html", kind: "file" },
    ]);
    expect(useProjectStore.getState().entryPoint).toBe(null);
  });

  it("opens the entry page through openEntryPoint, and is a no-op without one", async () => {
    const read = vi.fn().mockResolvedValue({
      relativePath: "index.html",
      text: "<!doctype html><title>Home</title>",
      hash: "c".repeat(64),
    });
    installBridge({
      pickProjectFolder: async () => "C:\\Projects\\demo",
      projectOpen: vi.fn().mockResolvedValue({
        root: "C:\\Projects\\demo",
        entries: [{ name: "index.html", relativePath: "index.html", kind: "file" }],
      }),
      projectReadFile: read,
    });

    await useProjectStore.getState().openProject();
    await useProjectStore.getState().openEntryPoint();

    expect(read).toHaveBeenCalledWith("index.html");
    expect(useProjectStore.getState().openFile?.text).toContain("<title>Home</title>");
    expect(useProjectStore.getState().selectedPath).toBe("index.html");

    // No entry: the action must not guess a file.
    useProjectStore.setState({ entryPoint: null });
    read.mockClear();
    await useProjectStore.getState().openEntryPoint();
    expect(read).not.toHaveBeenCalled();
  });

  it("loads directory entries on first expand and caches them", async () => {
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\x" }),
      projectList: vi
        .fn()
        .mockResolvedValueOnce([
          { name: "index.html", relativePath: "index.html", kind: "file" },
          { name: "css", relativePath: "css", kind: "directory" },
        ])
        .mockResolvedValueOnce([
          { name: "main.css", relativePath: "css/main.css", kind: "file" },
        ]),
    });

    await useProjectStore.getState().hydrate();
    const list = (window.astra as Partial<AstraApi>).projectList as ReturnType<typeof vi.fn>;
    list.mockClear();
    await useProjectStore.getState().toggleDirectory("css");
    expect(list).toHaveBeenCalledWith("css");
    expect(useProjectStore.getState().entriesByDirectory["css"]).toHaveLength(1);
    await useProjectStore.getState().toggleDirectory("css");
    await useProjectStore.getState().toggleDirectory("css");
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("selects a file and reads its contents", async () => {
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\x" }),
      projectList: async () => [
        { name: "index.html", relativePath: "index.html", kind: "file" },
      ],
      projectReadFile: vi.fn().mockResolvedValue({
        relativePath: "index.html",
        text: "<!doctype html><html><body>Hello</body></html>",
        hash: "a".repeat(64),
      }),
    });

    await useProjectStore.getState().hydrate();
    await useProjectStore.getState().selectFile("index.html");
    const state = useProjectStore.getState();
    expect(state.selectedPath).toBe("index.html");
    expect(state.openFile?.relativePath).toBe("index.html");
    expect(state.openFile?.text).toContain("Hello");
    expect(state.fileIssue).toBe(null);
  });

  it("marks a file as unavailable when reading fails", async () => {
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\x" }),
      projectList: async () => [
        { name: "missing.txt", relativePath: "missing.txt", kind: "file" },
      ],
      projectReadFile: vi.fn().mockRejectedValue(new Error("ENOENT: missing.txt")),
    });

    await useProjectStore.getState().hydrate();
    await useProjectStore.getState().selectFile("missing.txt");
    const state = useProjectStore.getState();
    expect(state.openFile).toBe(null);
    expect(state.fileIssue).toBe("unavailable");
  });

  it("handles external deletions of the open file", async () => {
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\x" }),
      projectList: async () => [
        { name: "note.txt", relativePath: "note.txt", kind: "file" },
      ],
      projectReadFile: vi.fn().mockResolvedValue({
        relativePath: "note.txt",
        text: "keep me",
        hash: "b".repeat(64),
      }),
    });

    await useProjectStore.getState().hydrate();
    await useProjectStore.getState().selectFile("note.txt");
    const stateAfterRead = useProjectStore.getState();
    expect(stateAfterRead.openFile?.text).toBe("keep me");

    await useProjectStore.getState().applyFsChanges([
      { type: "deleted", relativePath: "note.txt", kind: "file" },
    ]);
    const afterDelete = useProjectStore.getState();
    expect(afterDelete.openFile?.text).toBe("keep me");
    expect(afterDelete.fileIssue).toBe("unavailable");
    expect(afterDelete.selectedPath).toBe("note.txt");
  });

  it("reloads the open file on external change and records a notice", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ relativePath: "data.json", text: "{}", hash: "1".repeat(64) })
      .mockResolvedValueOnce({ relativePath: "data.json", text: "{\"v\":2}", hash: "2".repeat(64) });
    installBridge({
      getProjectState: async () => ({ root: "C:\\Projects\\x" }),
      projectList: async () => [
        { name: "data.json", relativePath: "data.json", kind: "file" },
      ],
      projectReadFile: read,
    });

    await useProjectStore.getState().hydrate();
    await useProjectStore.getState().selectFile("data.json");
    await useProjectStore.getState().applyFsChanges([
      { type: "changed", relativePath: "data.json", kind: "file" },
    ]);
    const state = useProjectStore.getState();
    expect(state.openFile?.text).toContain("v");
    expect(state.notice).toMatch(/Reloaded/);
  });

  it("closes the project and resets title", async () => {
    const close = vi.fn().mockResolvedValue({ root: null });
    installBridge({
      pickProjectFolder: async () => "C:\\Projects\\demo",
      projectOpen: vi.fn().mockResolvedValue({
        root: "C:\\Projects\\demo",
        entries: [{ name: "index.html", relativePath: "index.html", kind: "file" }],
      }),
      projectClose: close,
    });

    await useProjectStore.getState().openProject();
    expect(document.title).toBe("demo — Astra");
    await useProjectStore.getState().closeProject();
    const state = useProjectStore.getState();
    expect(state.root).toBe(null);
    expect(state.name).toBe(null);
    expect(state.entriesByDirectory).toEqual({});
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("Astra");
  });

  it("handles app commands via the command bus", async () => {
    const open = vi.fn().mockResolvedValue(null);
    installBridge({ pickProjectFolder: open });

    const { bindProjectCommands } = await import("../src/renderer/src/store/project-store");
    bindProjectCommands(useAppStore.getState(), useProjectStore.getState());
    useAppStore.getState().runCommand(MENU_COMMANDS.openProject);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(open).toHaveBeenCalled();
  });

  it("applyProjectTitle sets the document title correctly", () => {
    applyProjectTitle(null);
    expect(document.title).toBe("Astra");
    applyProjectTitle("demo");
    expect(document.title).toBe("demo — Astra");
  });
});
