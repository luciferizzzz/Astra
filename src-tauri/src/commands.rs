//! Tauri commands exposed to the main window.
//!
//! This is the foundation surface. Filesystem, watcher, hashing and atomic-write
//! commands are added in Phase 0 — and only to the *main* window (never the
//! sandboxed preview), scoped to the project root.

/// Smoke-test command: returns "pong".
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

/// Returns the application version from Cargo.toml.
#[tauri::command]
pub fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
