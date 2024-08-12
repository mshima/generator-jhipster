import vue from 'eslint-plugin-vue';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier/recommended';

import eslintWorker from '../../../generators/bootstrap/support/eslint-worker.js';

const additionalConfig = [
  ...vue.configs['flat/base'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: '@typescript-eslint/parser' },
      globals: { ...globals.browser },
    },
  },
  prettier,
  {
    rules: {
      'prettier/prettier': [
        'error',
        { printWidth: 140, singleQuote: true, tabWidth: 2, useTabs: false, arrowParens: 'avoid' },
        { usePrettierrc: false },
      ],
    },
  },
];

export default async options => eslintWorker({ ...options, ...(options.filePath.endsWith('.vue') ? { additionalConfig } : {}) });
