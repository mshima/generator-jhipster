import js from '@eslint/js';
import baseConfig from './base.js';

const recommended = {
  ...baseConfig,
  rules: {
    ...js.configs.recommended.rules,
    ...baseConfig.rules,
  },
};

export default recommended;
