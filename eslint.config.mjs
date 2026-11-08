// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Shared packages are imported by name (@note/contracts, @note/editor/<module>, @note/data/<module>).
const packagePaths = {
  group: ['**/packages/*/src/**', '**/contracts/src/**', '**/editor/src/**', '**/data/src/**'],
  message: 'Import shared packages by name, e.g. @note/contracts or @note/editor/schema.',
};
const restrict = (patterns) => ['error', { patterns: [...patterns, packagePaths] }];

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', '.runtime/**', 'docs/**'] },
  {
    files: ['**/*.{ts,tsx,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // Input validation deliberately matches control characters.
      'no-control-regex': 'off',
      // Store test doubles reference themselves from closures before assignment.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-imports': restrict([
        {
          group: ['**/apps/server/**', '**/server/src/**'],
          message: 'The web app talks to the server over HTTP only.',
        },
      ]),
    },
  },
  {
    // Components change the store only through slice actions.
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/**/state.ts', 'apps/web/src/state/store.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='useWorkspace'][property.name='setState']",
          message: 'Call a slice action instead of writing the store directly.',
        },
      ],
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        {
          group: ['**/apps/web/**', '**/web/src/**'],
          message: 'The server must not depend on the web app.',
        },
      ]),
    },
  },
  {
    // Routes translate HTTP to service calls; SQL lives in the owning service.
    files: [
      'apps/server/src/**/routes.ts',
      'apps/server/src/**/*-routes.ts',
      'apps/server/src/access/events.ts',
      'apps/server/src/documents/collaboration.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^(query|exec)$/][callee.object.name=/^(db|tx)$/], CallExpression[callee.property.name=/^(query|exec)$/][callee.object.property.name='db']",
          message: 'Move SQL into the owning service.',
        },
      ],
    },
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['**/apps/**'], message: 'Shared packages must not depend on applications.' },
      ]),
    },
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    rules: { 'no-restricted-imports': restrict([]) },
  },
);
