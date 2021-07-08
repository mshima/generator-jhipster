const path = require('path');
const expect = require('expect');

const { basicTests, testBlueprintSupport, testOptions } = require('../support');
const { skipPrettierHelpers: helpers } = require('../utils/utils');
const { requiredConfig, defaultConfig } = require('../../generators/build-tool/config');
const {
  constants: { BUILD_TOOL, MAVEN, GRADLE },
} = require('../../generators/build-tool/options');

const buildToolGeneratorPath = path.join(__dirname, '../../generators/build-tool');
const contextBuilder = () => helpers.create(buildToolGeneratorPath).withMockedGenerators(['jhipster:gradle', 'jhipster:maven']);

describe('JHipster build-tool generator', () => {
  basicTests({
    requiredConfig,
    defaultConfig,
    customPrompts: {
      [BUILD_TOOL]: GRADLE,
    },
    contextBuilder,
  });
  describe('blueprint support', () => testBlueprintSupport('build-tool'));
  describe('with valid', () => {
    describe('maven buildTool option', () => {
      testOptions({
        customOptions: {
          [BUILD_TOOL]: MAVEN,
        },
        contextBuilder,
      });
    });
    describe('gradle buildTool option', () => {
      testOptions({
        customOptions: {
          [BUILD_TOOL]: GRADLE,
        },
        contextBuilder,
      });
    });
    describe('maven buildTool config', () => {
      let runResult;
      before(async () => {
        runResult = await contextBuilder()
          .withOptions({ localConfig: { [BUILD_TOOL]: MAVEN } })
          .run();
      });
      it('should compose with maven generator', () => {
        expect(runResult.mockedGenerators['jhipster:maven'].calledOnce).toBeTruthy();
      });
    });
    describe('gradle buildTool config', () => {
      let runResult;
      before(async () => {
        runResult = await contextBuilder()
          .withOptions({ localConfig: { [BUILD_TOOL]: GRADLE } })
          .run();
      });
      it('should compose with gradle generator', () => {
        expect(runResult.mockedGenerators['jhipster:gradle'].calledOnce).toBeTruthy();
      });
    });
  });
});
