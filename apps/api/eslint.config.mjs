// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Two well-known Jest/typescript-eslint false positives, both stemming
    // from Jest's own types being deliberately loose:
    //  - `expect(mockObj.method).toHaveBeenCalled()` statically looks like an
    //    unbound method reference even though a jest mock function never
    //    relies on `this`.
    //  - `expect.any(String)` (and friends) is typed `any` by design, so
    //    building an object literal around it for `.toEqual()` trips
    //    no-unsafe-assignment even though the assertion is exactly the point.
    // Scoped to test files only -- `**/*.spec.ts` covers colocated unit
    // specs, `**/*.e2e-spec.ts` covers test/*.e2e-spec.ts (its "-spec.ts"
    // suffix doesn't match the first glob).
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
