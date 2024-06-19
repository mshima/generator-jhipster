import unusedImports from 'eslint-plugin-unused-imports';
import imports from 'eslint-plugin-import';

export const baseRules = {
  'no-unused-vars': 'off',
  'import/no-duplicates': 'error',
  'import/order': 'error',
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': [
    'warn',
    {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'after-used',
      argsIgnorePattern: '^_',
    },
  ],
};

const blueprintConfig = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/parsers': {
      espree: ['.js', '.cjs', '.mjs', '.jsx'],
    },
    'import/resolver': {
      node: true,
    },
  },
  plugins: {
    'unused-imports': unusedImports,
    import: imports,
  },
  rules: baseRules,
};

export default blueprintConfig;
