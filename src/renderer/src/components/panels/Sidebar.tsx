import { useEffect, useState } from "react";
import { AUTOSAVE_OFF } from "../../../../shared/settings";
import { useAppStore } from "@/store/app-store";
import { useProjectStore } from "@/store/project-store";
import FileTree from "./FileTree";
import { useCanvasTreeStore } from "@/store/canvas-tree-store";

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
 *
 * The panel can also be collapsed to an icon rail. Collapsing and hiding are
 * different gestures on purpose: the menu's "Toggle Sidebar" removes the region
 * entirely (the canvas takes the space), while the chevron narrows it to icons
 * and keeps one-click access to every section.
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
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useAppStore((state) => state.toggleSidebarCollapsed);
  const setCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const root = useProjectStore((state) => state.root);
  const openProject = useProjectStore((state) => state.openProject);
  const tree = useCanvasTreeStore((state) => state.tree);
  const refreshTree = useCanvasTreeStore((state) => state.refresh);

  useEffect(() => {
    if (active === "Components") {
      void refreshTree();
    }
  }, [active, refreshTree]);

  if (collapsed) {
    return (
      <aside
        aria-label="Sidebar"
        className="flex w-12 shrink-0 flex-col items-center border-r border-border-subtle bg-surface-1 py-1"
      >
        <button
          type="button"
          aria-label="Expand sidebar"
          aria-expanded={false}
          title="Expand sidebar"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-fg-faint hover:bg-surface-2 hover:text-fg"
        >
          <Chevron direction="right" />
        </button>

        <div className="my-1 h-px w-6 bg-border-subtle" />

        <nav aria-label="Sidebar sections" className="flex flex-col items-center gap-1">
          {SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              aria-label={section}
              title={section}
              onClick={() => {
                setActive(section);
                setCollapsed(false);
              }}
              className={`rounded p-1.5 transition-colors ${
                section === active
                  ? "bg-surface-2 text-fg"
                  : "text-fg-subtle hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <SectionIcon section={section} />
            </button>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Sidebar"
      className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-1"
    >
      <div className="flex items-center justify-end px-2 pt-1">
        <button
          type="button"
          aria-label="Collapse sidebar"
          aria-expanded={true}
          title="Collapse sidebar"
          onClick={toggleCollapsed}
          className="rounded p-1 text-fg-faint hover:bg-surface-2 hover:text-fg-muted"
        >
          <Chevron direction="left" />
        </button>
      </div>

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
        ) : active === "Components" ? (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-fg-subtle">Layer tree</span>
              <button
                type="button"
                onClick={() => void refreshTree()}
                className="rounded px-1 py-0.5 text-[10px] text-fg-faint hover:bg-surface-2"
              >
                Refresh
              </button>
            </div>
            {tree?.root ? (
              <LayerTreeNode node={tree.root} />
            ) : (
              <p className="leading-relaxed text-fg-faint">No canvas tree yet. Click an element on the canvas.</p>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-fg-faint">{EMPTY_STATE[active]}</p>
        )}
      </div>
    </aside>
  );
}

/**
 * The collapse control. A chevron is enough here — the accessible name lives on
 * the button (`Collapse sidebar` / `Expand sidebar`), not on the glyph.
 */
function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "left" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"} />
    </svg>
  );
}

/**
 * Rail icons for the collapsed sidebar. Inline SVG keeps them dependency-free;
 * each button carries the section name, so the glyph itself is decorative.
 */
function SectionIcon({ section }: { section: Section }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {section === "Files" ? (
        <>
          <path d="M4 2.5h5l3 3v8H4z" />
          <path d="M9 2.5v3h3" />
        </>
      ) : section === "Components" ? (
        <>
          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.5" />
          <rect x="9" y="9" width="4.5" height="4.5" rx="0.5" />
          <path d="M7 4.75h4.5M4.75 7v4.5" />
        </>
      ) : section === "Design" ? (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="6" cy="6.5" r="0.6" fill="currentColor" />
          <circle cx="9.5" cy="6" r="0.6" fill="currentColor" />
          <path d="M5 9.5c1 1.5 4 1.5 5.5 0" />
        </>
      ) : section === "Assets" ? (
        <>
          <rect x="2.5" y="3" width="11" height="10" rx="0.5" />
          <path d="m3 11 3-3 2.5 2.5 2-2 2.5 2.5" />
          <circle cx="10" cy="5.5" r="0.8" />
        </>
      ) : (
        <>
          <path d="M3 5h10M3 11h10" />
          <circle cx="6" cy="5" r="1.5" />
          <circle cx="10" cy="11" r="1.5" />
        </>
      )}
    </svg>
  );
}

import { useCanvasStore } from "@/store/canvas-store";

function isReadOnlyTag(tag: string): boolean {
  const t = tag.toLowerCase();
  return t === "svg" || t === "canvas" || t === "iframe" || t === "script" || t === "style" || t === "link" || t === "meta" || t === "head";
}

function LayerTreeNode({ node }: { node: import("../../../../shared/ipc").CanvasTreeNode }) {
  const [open, setOpen] = useState(true);
  const selectBySelector = useCanvasStore((s) => s.selectBySelector);
  const selection = useCanvasStore((s) => s.selection);
  const hasChildren = node.children.length > 0;
  const tagLower = node.tagName.toLowerCase();
  const readOnly = isReadOnlyTag(tagLower);
  const label = `${tagLower}${node.id ? `#${node.id}` : ""}${node.className ? `.${node.className.trim().split(/\s+/).filter(Boolean).join(".")}` : ""}`;
  const isSelected = selection?.selector === node.selector;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={(e) => {
          // Don't toggle collapse when clicking to select? toggle on click is fine, but also select
          // If clicking caret area we could detect, but simple: select on click; user can still expand via double? 
          // Keep existing toggle behavior but also trigger selection
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
            setOpen((v) => !v);
            return;
          }
          // Select element in canvas (two-way sync)
          if (node.selector) {
            selectBySelector(node.selector);
          }
          setOpen((v) => !v);
        }}
        className={`flex items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-surface-2 ${isSelected ? "bg-surface-2 text-fg" : "text-fg-muted"}`}
        style={{ paddingLeft: "0.25rem" }}
        title={node.selector}
      >
        {hasChildren ? <span className="text-[10px] text-fg-faint">{open ? "▾" : "▸"}</span> : <span className="w-2" />}
        <span className="truncate">{label}</span>
        {readOnly ? <span className="ml-auto text-[9px] text-fg-faint">read-only</span> : null}
      </button>
      {hasChildren && open ? (
        <div className="ml-3 flex flex-col">
          {node.children.map((child, idx) => (
            <LayerTreeNode key={idx} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
