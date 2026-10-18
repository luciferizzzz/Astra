import { useState } from "react";
import { AUTOSAVE_OFF } from "../../../../shared/settings";
import { useAppStore } from "@/store/app-store";
import { useProjectStore } from "@/store/project-store";
import FileTree from "./FileTree";

/**
 * The left panel: project navigation.
 *
 * The tabs are the five things the design language reserves the left rail for
 * (see the vault note "Design & UX"). Only the tab switching and the Settings
 * summary are live; the other panes are empty states that name what will fill
 * them, so the shell never implies data it does not have.
 *
 * Settings is a summary, not the editor: the real surface is a dialog that the
 * menu, the toolbar and the shortcut all open. Repeating the form here would
 * give the app two settings UIs to keep in step.
 */

const SECTIONS = ["Files", "Components", "Design", "Assets", "Settings"] as const;

type Section = (typeof SECTIONS)[number];

const EMPTY_STATE: Record<Exclude<Section, "Settings">, string> = {
  Files: "Open a project folder to see its files here.",
  Components: "Saved components will be listed here.",
  Design: "Design tokens — colours, type, spacing — will live here.",
  Assets: "Images and fonts from the project will appear here.",
};

function describeAutosave(intervalMs: number): string {
  if (intervalMs === AUTOSAVE_OFF) return "Off";
  return `${intervalMs / 1000}s after the last change`;
}

export default function Sidebar() {
  const [active, setActive] = useState<Section>("Files");
  const settings = useAppStore((state) => state.settings);
  const openSettings = useAppStore((state) => state.openSettings);
  const root = useProjectStore((state) => state.root);
  const openProject = useProjectStore((state) => state.openProject);


  return (
    <aside
      aria-label="Sidebar"
      className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-1"
    >
      <nav role="tablist" aria-label="Sidebar sections" className="flex flex-wrap gap-1 border-b border-border-subtle p-2">
        {SECTIONS.map((section) => {
          const selected = section === active;
          return (
            <button
              key={section}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(section)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                selected
                  ? "bg-surface-2 text-fg"
                  : "text-fg-subtle hover:bg-surface-2 hover:text-fg-muted"
              }`}
            >
              {section}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-auto p-3">
        {active === "Settings" ? (
          <div className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-fg-faint">Theme</dt>
                <dd className="text-fg-muted">{settings.theme}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-fg-faint">Font size</dt>
                <dd className="text-fg-muted">{settings.fontSize}px</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-fg-faint">Autosave</dt>
                <dd className="text-right text-fg-muted">{describeAutosave(settings.autosaveIntervalMs)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={openSettings}
              className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-muted hover:bg-surface-2"
            >
              Open settings
            </button>
          </div>
        ) : active === "Files" && root !== null ? (
          <div className="flex flex-col gap-2">
            <FileTree />
          </div>
        ) : active === "Files" ? (
          <div className="flex flex-col gap-2 text-xs">
            <p className="leading-relaxed text-fg-faint">{EMPTY_STATE[active]}</p>
            <button
              type="button"
              onClick={() => void openProject()}
              className="self-start rounded border border-border-subtle px-2 py-1 text-xs text-fg-muted hover:bg-surface-2"
            >
              Open Project
            </button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-fg-faint">{EMPTY_STATE[active]}</p>
        )}
      </div>
    </aside>
  );
}
