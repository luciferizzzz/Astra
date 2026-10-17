/**
 * The right panel: the inspector.
 *
 * It mirrors the left rail's tab pattern so the two panels read as a pair. The
 * panes are deliberately empty: the inspector describes the current selection,
 * and there is no selection model yet. Saying so beats faking a form.
 */

const TABS = ["Inspector", "Styles", "Layout", "Attributes"] as const;

export default function Inspector() {
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

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <p className="text-center text-xs leading-relaxed text-fg-faint">
          Select an element on the canvas to edit it.
        </p>
      </div>
    </aside>
  );
}
