import { useEffect, useRef } from "react";
import {
  AUTOSAVE_MAX_MS,
  AUTOSAVE_MIN_MS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  SETTINGS_THEMES,
  type AstraSettings,
} from "../../../../shared/settings";
import { useAppStore } from "@/store/app-store";

/**
 * The application settings surface (FR-A05).
 *
 * A modal rather than a panel: settings are a short, occasional detour from the
 * work, and giving them the whole window keeps the six controls on one screen
 * instead of buried behind the sidebar's tab strip.
 *
 * Every control writes straight through the store, and the main process is the
 * one that persists and normalises the result — the dialog never invents a value
 * the main process would reject, and it renders whatever comes back rather than
 * what it hoped for. The theme and font size apply the moment they change,
 * because both are reflected onto the document by the store.
 *
 * Telemetry is shown but locked off: this build has no telemetry endpoint, and a
 * toggle that appeared to switch something on would be a lie (FR-K03).
 */

const AUTOSAVE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "Off (save with Ctrl+S)" },
  { value: 500, label: "0.5 s after the last change" },
  { value: 1000, label: "1 s after the last change" },
  { value: 2000, label: "2 s after the last change" },
  { value: 5000, label: "5 s after the last change" },
];

const FIELD_LABEL = "text-xs font-medium text-fg-muted";
const FIELD_HINT = "mt-1 text-[11px] leading-relaxed text-fg-faint";
const CONTROL =
  "mt-1 w-full rounded border border-border-subtle bg-surface-2 px-2 py-1 text-xs text-fg outline-none focus:border-accent";

export default function SettingsDialog() {
  const settings = useAppStore((state) => state.settings);
  const closeSettings = useAppStore((state) => state.closeSettings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSettings]);

  function update<K extends keyof AstraSettings>(key: K, value: AstraSettings[K]): void {
    void updateSettings({ [key]: value } as Partial<AstraSettings>);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      // Clicking the backdrop closes; clicking inside the dialog does not.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-1 shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Settings</h2>
          <button
            type="button"
            onClick={closeSettings}
            aria-label="Close settings"
            className="rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
          <p className="text-[11px] leading-relaxed text-fg-faint">
            Preferences are per user and stored on this machine. Nothing here is sent anywhere.
          </p>

          <div>
            <label className={FIELD_LABEL} htmlFor="setting-theme">
              Theme
            </label>
            <select
              id="setting-theme"
              className={CONTROL}
              value={settings.theme}
              onChange={(event) => update("theme", event.target.value as AstraSettings["theme"])}
            >
              {SETTINGS_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {theme[0]?.toUpperCase()}
                  {theme.slice(1)}
                </option>
              ))}
            </select>
            <p className={FIELD_HINT}>“System” follows your operating system appearance.</p>
          </div>

          <div>
            <label className={FIELD_LABEL} htmlFor="setting-font-size">
              Code font size
            </label>
            <input
              id="setting-font-size"
              type="number"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              className={CONTROL}
              value={settings.fontSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isInteger(next)) return;
                update("fontSize", Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, next)));
              }}
            />
            <p className={FIELD_HINT}>
              {FONT_SIZE_MIN}–{FONT_SIZE_MAX} px. Applies to the code editor and other monospaced surfaces.
            </p>
          </div>

          <div>
            <label className={FIELD_LABEL} htmlFor="setting-autosave">
              Autosave
            </label>
            <select
              id="setting-autosave"
              className={CONTROL}
              value={settings.autosaveIntervalMs}
              onChange={(event) => update("autosaveIntervalMs", Number(event.target.value))}
            >
              {AUTOSAVE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className={FIELD_HINT}>
              Off by default, so a first release never writes without being asked. Bounds:{" "}
              {AUTOSAVE_MIN_MS / 1000}s–{AUTOSAVE_MAX_MS / 1000}s.
            </p>
          </div>

          <div>
            <label className={FIELD_LABEL} htmlFor="setting-formatting">
              Formatting policy
            </label>
            <select
              id="setting-formatting"
              className={CONTROL}
              value={settings.formattingPolicy}
              onChange={(event) =>
                update("formattingPolicy", event.target.value as AstraSettings["formattingPolicy"])
              }
            >
              <option value="preserve">Preserve existing formatting</option>
              <option value="match-project">Match the project’s style</option>
            </select>
            <p className={FIELD_HINT}>
              Existing bytes are never reformatted; this only governs markup Astra generates itself.
            </p>
          </div>

          <div>
            <label className={FIELD_LABEL} htmlFor="setting-external-resources">
              External resources
            </label>
            <select
              id="setting-external-resources"
              className={CONTROL}
              value={settings.externalResourcePolicy}
              onChange={(event) =>
                update("externalResourcePolicy", event.target.value as AstraSettings["externalResourcePolicy"])
              }
            >
              <option value="block">Block (offline-safe)</option>
              <option value="allow">Allow with confirmation</option>
            </select>
            <p className={FIELD_HINT}>
              Remote stylesheets, scripts and fonts. Blocking keeps the preview offline; the preview
              will say when something was held back.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded border border-border-subtle p-3">
            <input id="setting-telemetry" type="checkbox" checked={false} disabled className="mt-0.5" />
            <div>
              <label className={FIELD_LABEL} htmlFor="setting-telemetry">
                Usage analytics
              </label>
              <p className={FIELD_HINT}>
                Off, and not configurable in this build: Astra has no telemetry endpoint and transmits
                no analytics or usage data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
