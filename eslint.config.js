import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

export default [
  ...neostandard({
    ts: true,
    ignores: resolveIgnoresFromGitignore()
  }),
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
]
