/**
 * User preferences, shared by the main process, the preload allowlist and the
 * renderer.
 *
 * Like `./ipc`, this module is bundled into all three processes, so it holds
 * frozen constants, types and pure functions only — no Electron, no Node, no
 * side effects. The main process owns the persisted copy; the renderer only ever
 * sees what the narrow preload surface publishes.
 *
 * Settings are **per user**, not per project (FR-A05): the project-level config
 * that lives under a project's `.astra/` directory is a later phase. See PRD
 * §9 (UX), FR-A05, FR-K03, FR-K04 and FR-G09.
 */

/** How the interface resolves its colour scheme. */
export const SETTINGS_THEMES = ["system", "dark", "light"] as const;
export type SettingsTheme = (typeof SETTINGS_THEMES)[number];

/**
 * What Astra may do to markup it generates itself.
 *
 * `preserve` never reformats: existing bytes are sacred, and new fragments are
 * emitted on one line. `match-project` is the best-effort attempt to imitate the
 * indentation the project already uses (FR-G09).
 */
export const FORMATTING_POLICIES = ["preserve", "match-project"] as const;
export type FormattingPolicy = (typeof FORMATTING_POLICIES)[number];

/**
 * What the preview may load from the network.
 *
 * `block` is the MVP default: a project that references a CDN stylesheet still
 * opens, but the preview says so instead of silently fetching it (FR-K04).
 */
export const EXTERNAL_RESOURCE_POLICIES = ["block", "allow"] as const;
export type ExternalResourcePolicy = (typeof EXTERNAL_RESOURCE_POLICIES)[number];

export interface AstraSettings {
  readonly theme: SettingsTheme;
  /** Base size, in px, for the code editor and other monospaced surfaces. */
  readonly fontSize: number;
  /** Debounce before an autosave, in ms. `0` disables autosave; saving stays explicit. */
  readonly autosaveIntervalMs: number;
  /** Opt-in only. Astra collects nothing in this build (FR-K03). */
  readonly telemetry: boolean;
  readonly formattingPolicy: FormattingPolicy;
  readonly externalResourcePolicy: ExternalResourcePolicy;
}

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;

/** Autosave is off by default: a first release should never write on its own. */
export const AUTOSAVE_OFF = 0;
export const AUTOSAVE_MIN_MS = 500;
export const AUTOSAVE_MAX_MS = 60_000;

export const DEFAULT_SETTINGS: AstraSettings = Object.freeze({
  theme: "system",
  fontSize: 13,
  autosaveIntervalMs: AUTOSAVE_OFF,
  telemetry: false,
  formattingPolicy: "preserve",
  externalResourcePolicy: "block",
});

function isTheme(value: unknown): value is SettingsTheme {
  return typeof value === "string" && (SETTINGS_THEMES as readonly string[]).includes(value);
}

function isFormattingPolicy(value: unknown): value is FormattingPolicy {
  return typeof value === "string" && (FORMATTING_POLICIES as readonly string[]).includes(value);
}

function isExternalResourcePolicy(value: unknown): value is ExternalResourcePolicy {
  return (
    typeof value === "string" &&
    (EXTERNAL_RESOURCE_POLICIES as readonly string[]).includes(value)
  );
}

/** True for a whole number that is a legal font size. */
export function isFontSize(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= FONT_SIZE_MIN && value <= FONT_SIZE_MAX;
}

/** True for `0`, or a whole number of milliseconds inside the allowed window. */
export function isAutosaveInterval(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (value === AUTOSAVE_OFF) return true;
  return value >= AUTOSAVE_MIN_MS && value <= AUTOSAVE_MAX_MS;
}

/**
 * Coerces a value read from disk or sent over IPC into a known field.
 *
 * Returns `undefined` for anything unrecognised, so the caller decides whether
 * an unknown field is a mistake to reject (IPC) or debris to drop (a file
 * written by an older build). It never throws, and never guesses a type.
 */
export function coerceSettingValue(key: keyof AstraSettings, value: unknown): AstraSettings[keyof AstraSettings] | undefined {
  switch (key) {
    case "theme":
      return isTheme(value) ? value : undefined;
    case "fontSize":
      return isFontSize(value) ? value : undefined;
    case "autosaveIntervalMs":
      return isAutosaveInterval(value) ? value : undefined;
    case "telemetry":
      return typeof value === "boolean" ? value : undefined;
    case "formattingPolicy":
      return isFormattingPolicy(value) ? value : undefined;
    case "externalResourcePolicy":
      return isExternalResourcePolicy(value) ? value : undefined;
  }
}

/**
 * Fills an arbitrary object with the defaults, dropping any field that is
 * missing, the wrong type, or outside its allowed range.
 *
 * Used when *reading* — a settings file an older build wrote, or one a user
 * edited by hand, must never stop the app from starting.
 */
export function normalizeSettings(input: unknown): AstraSettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return DEFAULT_SETTINGS;
  }

  const record = input as Record<string, unknown>;
  const result: { -readonly [K in keyof AstraSettings]: AstraSettings[K] } = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AstraSettings>) {
    const coerced = coerceSettingValue(key, record[key]);
    if (coerced !== undefined) {
      // Each branch above has already narrowed the value to the field's type.
      (result[key] as AstraSettings[typeof key]) = coerced as AstraSettings[typeof key];
    }
  }

  return result;
}

/** The keys a settings patch may carry. */
export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof AstraSettings>;
