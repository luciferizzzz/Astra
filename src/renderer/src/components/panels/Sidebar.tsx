import { useState } from "react";

/**
 * The left panel: project navigation.
 *
 * The tabs are the five things the design language reserves the left rail for
 * (see the vault note "Design & UX"). Only the tab switching is live; each pane
 * is an empty state that names what will fill it, so the shell never implies
 * data it does not have.
 */

const SECTIONS = ["Files", "Components", "Design", "Assets", "Settings"] as const;

type Section = (typeof SECTIONS)[number];

const EMPTY_STATE: Record<Section, string> = {
  Files: "Open a project folder to see its files here.",
  Components: "Saved components will be listed here.",
  Design: "Design tokens — colours, type, spacing — will live here.",
  Assets: "Images and fonts from the project will appear here.",
  Settings: "Project and app settings will appear here.",
};

export default function Sidebar() {
  const [active, setActive] = useState<Section>("Files");

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
                  ? "bg-surface-2 text-neutral-100"
                  : "text-neutral-500 hover:bg-surface-2 hover:text-neutral-300"
              }`}
            >
              {section}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-auto p-3">
        <p className="text-xs leading-relaxed text-neutral-600">{EMPTY_STATE[active]}</p>
      </div>
    </aside>
  );
}
