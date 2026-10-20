// ESLint flat config — NFR-010 ("lint clean (main, preload, renderer)").
//
// Deliberately the non-type-checked ruleset (typescript-eslint `recommended`
// rather than `recommendedTypeChecked`): type-aware rules duplicate what
// `npm run typecheck` already enforces with `strict: true`, at a much higher
// runtime cost, and this project treats tsc — not ESLint — as the type gate.
// ESLint's job here is correctness-of-patterns that types cannot express:
// unused bindings, hook rules, accidental globals, floating patterns.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    // Generated / packaged output. `out/` and `release/` are electron-vite and
    // electron-builder artifacts; `fixtures/` is HTML/CSS test data, not source.
    ignores: ['out/**', 'release/**', 'fixtures/**', 'coverage/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `any` is an intentional escape hatch in a handful of IPC boundary
      // surfaces; the codebase bans it by review, not by lint rule.
      '@typescript-eslint/no-explicit-any': 'off',
      // Underscore-prefixed bindings are the codebase's explicit "intentionally
      // unused" signal (stub signatures, catch-through parameters).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // This codebase never relies on `== null` coercion semantics, but the
      // project style prefers explicit `=== null` / `=== undefined`.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Main and preload run under Node with full CommonJS-style globals.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'electron.vite.config.mts', 'vitest.config.mts', 'playwright.config.mts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Node scripts and tests legitimately log; the no-console rule above is
    // aimed at renderer UI code only.
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'e2e/**/*.ts', 'scripts/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
);
