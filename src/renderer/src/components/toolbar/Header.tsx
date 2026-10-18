import logo from "@/assets/Astra-logo.svg";
import { useAppStore, type ViewportPreset } from "@/store/app-store";
import { useProjectStore } from "@/store/project-store";

/**
 * The application toolbar.
 *
 * The regions of the toolbar are still mostly a wireframe: undo/redo wait for
 * the history engine. The controls whose behaviour exists today — the viewport
 * presets, the preview toggle, Settings and "Open/Close Project" — are live.
 */

const VIEWPORTS: ReadonlyArray<{ id: ViewportPreset; label: string; hint: string }> = [
  { id: "desktop", label: "Desktop", hint: "Preview at desktop width" },
  { id: "tablet", label: "Tablet", hint: "Preview at tablet width" },
  { id: "mobile", label: "Mobile", hint: "Preview at mobile width" },
];

const INERT_BUTTON = "cursor-not-allowed rounded px-2 py-1 text-xs text-fg-muted opacity-70";
const LIVE_BUTTON = "rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-2";
const ACTIVE_BUTTON = "rounded bg-surface-2 px-2 py-1 text-xs text-fg";

export default function Header() {
  const viewport = useAppStore((state) => state.viewport);
  const setViewport = useAppStore((state) => state.setViewport);
  const mode = useAppStore((state) => state.mode);
  const togglePreview = useAppStore((state) => state.togglePreview);
  const openSettings = useAppStore((state) => state.openSettings);
  const projectName = useProjectStore((state) => state.name);
  const entryPoint = useProjectStore((state) => state.entryPoint);
  const openProject = useProjectStore((state) => state.openProject);
  const closeProject = useProjectStore((state) => state.closeProject);
  const openEntryPoint = useProjectStore((state) => state.openEntryPoint);

  return (
    <header
      aria-label="Toolbar"
      className="flex shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-1 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <img src={logo} alt="" aria-hidden="true" className="h-6 w-6 rounded" />
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight text-fg">Astra</h1>
          <p className="text-[10px] text-fg-subtle">Design visually. Own your code.</p>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void openProject()}
          className={LIVE_BUTTON}
          aria-label="Open a project folder"
        >
          Open Project
        </button>
        {projectName ? (
          <>
            <span className="text-xs text-fg-muted" data-testid="project-name">
              {projectName}
            </span>
            <button
              type="button"
              onClick={() => void closeProject()}
              className={LIVE_BUTTON}
              aria-label="Close the open project"
            >
              Close Project
            </button>
            {entryPoint !== null ? (
              <button
                type="button"
                onClick={() => void openEntryPoint()}
                className={LIVE_BUTTON}
                title="Open the project's entry page"
                aria-label={`Open the entry page (${entryPoint})`}
                data-testid="entry-point"
              >
                Entry: {entryPoint}
              </button>
            ) : (
              <span className="text-xs text-fg-faint" data-testid="no-entry-point">
                No entry page
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-fg-faint">No project open</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="History">
          <button type="button" disabled title="Undo the last change" aria-label="Undo the last change" className={INERT_BUTTON}>
            Undo
          </button>
          <button type="button" disabled title="Redo the last undone change" aria-label="Redo the last undone change" className={INERT_BUTTON}>
            Redo
          </button>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Viewport">
          {VIEWPORTS.map((preset) => {
            const selected = preset.id === viewport;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                aria-label={preset.hint}
                aria-pressed={selected}
                onClick={() => setViewport(preset.id)}
                className={selected ? ACTIVE_BUTTON : LIVE_BUTTON}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Workspace">
          <button
            type="button"
            title="Toggle the preview"
            aria-label="Toggle the preview"
            aria-pressed={mode === "preview"}
            onClick={togglePreview}
            className={mode === "preview" ? ACTIVE_BUTTON : LIVE_BUTTON}
          >
            Preview
          </button>
          <button
            type="button"
            title="Open application settings"
            aria-label="Open application settings"
            onClick={openSettings}
            className={LIVE_BUTTON}
          >
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}
