/**
 * The right panel: the inspector.
 *
 * Shows selection info from the canvas (read-only for now, FR-C05).
 */

import { useCanvasStore } from "@/store/canvas-store";

const TABS = ["Inspector", "Styles", "Layout", "Attributes"] as const;

export default function Inspector() {
  const selection = useCanvasStore((state) => state.selection);

  return (
    <aside
      aria-label="Inspector"
      className="flex w-64 shrink-0 flex-col border-l border-border-subtle bg-surface-1"
    >
      <nav aria-label="Inspector sections" className="flex gap-1 border-b border-border-subtle p-2">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            disabled={index !== 0}
            aria-current={index === 0 ? "true" : undefined}
            className={`rounded px-2 py-1 text-xs ${
              index === 0 ? "bg-surface-2 text-fg" : "text-fg-faint opacity-60"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3 text-xs">
        {selection?.found ? (
          <>
            <div>
              <div className="text-fg-subtle">Element</div>
              <div className="text-fg">
                {selection.tagName?.toLowerCase()}
                {selection.id ? `#${selection.id}` : ""}
                {selection.className ? `.${selection.className.replace(/\s+/g, ".")}` : ""}
              </div>
            </div>
            {selection.path && selection.path.length > 0 ? (
              <div>
                <div className="text-fg-subtle">Path</div>
                <div className="text-fg break-all">{selection.path.join(" > ")}</div>
              </div>
            ) : null}
            {selection.selector ? (
              <div>
                <div className="text-fg-subtle">Selector</div>
                <div className="text-fg break-all">{selection.selector}</div>
              </div>
            ) : null}
            {selection.rect ? (
              <div>
                <div className="text-fg-subtle">Box</div>
                <div className="text-fg">
                  {Math.round(selection.rect.width)} × {Math.round(selection.rect.height)} @ (
                  {Math.round(selection.rect.x)}, {Math.round(selection.rect.y)})
                </div>
              </div>
            ) : null}
            <div className="mt-2 text-[10px] text-fg-faint">Read-only (origin)</div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-xs leading-relaxed text-fg-faint">
              Select an element on the canvas to edit it.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
