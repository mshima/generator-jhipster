const path = require('path');
const expect = require('expect');

const { skipPrettierHelpers: helpers } = require('../utils/utils');
const { GENERATOR_JHIPSTER } = require('../../generators/generator-constants');

const mavenGeneratorPath = path.join(__dirname, '../../generators/maven');

describe('JHipster maven generator', () => {
  describe('with valid configuration', () => {
    let runResult;
    before(async () => {
      runResult = await helpers.run(mavenGeneratorPath).withOptions({
        localConfig: {
          baseName: 'existing',
          packageName: 'tech.jhipster',
        },
      });
    });
    it('should generate only maven files', () => {
      expect(runResult.getStateSnapshot()).toMatchSnapshot();
    });
    it('should add contents to pom.xml', () => {
      runResult.assertFileContent('pom.xml', 'existing');
      runResult.assertFileContent('pom.xml', 'tech.jhipster');
    });
    it('should set buildTool config', () => {
      runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: { buildTool: 'maven' } });
    });
  });
  describe('with empty configuration', () => {
    let runResult;
    before(async () => {
      runResult = await helpers.run(mavenGeneratorPath);
    });
    it('should generate only maven files', () => {
      expect(runResult.getStateSnapshot()).toMatchSnapshot();
    });
    it('should add contents to pom.xml', () => {
      runResult.assertFileContent('pom.xml', 'jhipster');
      runResult.assertFileContent('pom.xml', 'com.mycompany.myapp');
    });
    it('should set buildTool config', () => {
      runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: { buildTool: 'maven' } });
    });
  });
});
