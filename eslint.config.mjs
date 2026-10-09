import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // The engine must stay framework-independent.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'next/*', 'socket.io*', '@prisma/*', 'node:*', '../server/*', '../components/*'] }],
      // Determinism: no ambient randomness, clocks or I/O inside the engine.
      'no-restricted-properties': ['error', { object: 'Math', property: 'random' }, { object: 'Date', property: 'now' }],
      'no-restricted-globals': ['error', 'console', 'process', 'fetch', 'setTimeout', 'setInterval'],
    },
  },
  { files: ['src/server/logger.ts', 'scripts/**'], rules: { 'no-console': 'off' } },
];
