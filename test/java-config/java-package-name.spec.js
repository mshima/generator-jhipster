const path = require('path');

const { basicTests, testBlueprintSupport } = require('../support');
const { requiredConfig, defaultConfig } = require('../../generators/java-config/config');

describe('JHipster java-config generator', () => {
  basicTests({
    requiredConfig,
    defaultConfig,
    customPrompts: {
      packageName: 'my.custom.package.name',
      buildTool: 'any',
    },
    generatorPath: path.join(__dirname, '../../generators/java-config'),
  });
  describe('blueprint support', () => testBlueprintSupport('java-config'));
});
