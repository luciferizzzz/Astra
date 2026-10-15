import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the aliases in tsconfig.json and electron.vite.config.mts.
    alias: {
      "@": fileURLToPath(new URL("./src/renderer/src", import.meta.url)),
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        // These entry points need a live Electron process behind them. The
        // logic they wire up lives in modules covered separately, so
        // instrumenting the entry points themselves would only report noise.
        "src/renderer/src/main.tsx",
        "src/main/index.ts",
        "src/preload/index.ts",
      ],
    },
  },
});
