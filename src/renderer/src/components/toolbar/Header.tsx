import logo from "@/assets/Astra-logo.svg";

/**
 * The application toolbar.
 *
 * A wireframe, not a working toolbar: every control is present and labelled so
 * the layout, focus order and affordances are real, but each is disabled until
 * the feature behind it exists. Keeping them visible — and inert — is the
 * honest version of "not built yet"; a toolbar that silently drops buttons
 * reads as finished when it is not.
 */

const TOOL_GROUPS: ReadonlyArray<ReadonlyArray<{ label: string; hint: string }>> = [
  [
    { label: "Undo", hint: "Undo the last change" },
    { label: "Redo", hint: "Redo the last undone change" },
  ],
  [
    { label: "Desktop", hint: "Preview at desktop width" },
    { label: "Tablet", hint: "Preview at tablet width" },
    { label: "Mobile", hint: "Preview at mobile width" },
  ],
  [
    { label: "Preview", hint: "Open the sandboxed preview" },
    { label: "Settings", hint: "Project settings" },
  ],
];

export default function Header() {
  return (
    <header
      aria-label="Toolbar"
      className="flex shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-1 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <img src={logo} alt="" aria-hidden="true" className="h-6 w-6 rounded" />
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight text-neutral-100">Astra</h1>
          <p className="text-[10px] text-neutral-500">Design visually. Own your code.</p>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Open a project folder"
          className="cursor-not-allowed rounded border border-border-subtle px-2 py-1 text-xs text-neutral-400 opacity-70"
        >
          Open Project
        </button>
        <span className="text-xs text-neutral-600">No project open</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {TOOL_GROUPS.map((group, index) => (
          <div key={index} className="flex items-center gap-1" role="group">
            {group.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled
                title={item.hint}
                aria-label={item.hint}
                className="cursor-not-allowed rounded px-2 py-1 text-xs text-neutral-400 opacity-70 hover:bg-surface-2"
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </header>
  );
}
