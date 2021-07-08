const expect = require('expect');
const path = require('path');
const sinon = require('sinon');

const { GENERATOR_JHIPSTER } = require('../../generators/generator-constants');
const { skipPrettierHelpers: helpers } = require('../utils/utils');

const testOptions = data => {
  const { generatorPath, customOptions, contextBuilder = () => helpers.create(generatorPath) } = data;
  let runResult;
  before(async () => {
    runResult = await contextBuilder()
      .withOptions({ ...customOptions })
      .run();
  });
  it('should write options to .yo-rc.json', () => {
    runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: customOptions });
  });
};

const basicTests = data => {
  const { generatorPath, customPrompts, requiredConfig, defaultConfig, contextBuilder = () => helpers.create(generatorPath) } = data;
  describe('with default options', () => {
    let runResult;
    before(async () => {
      runResult = await contextBuilder().run();
    });
    it('should write default config to .yo-rc.json', () => {
      runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: requiredConfig });
    });
    it('should load default config into the generator', () => {
      expect(runResult.generator).toMatchObject(requiredConfig);
    });
  });
  describe('with defaults option', () => {
    let runResult;
    before(async () => {
      runResult = await contextBuilder().withOptions({ defaults: true }).run();
    });
    it('should write default config to .yo-rc.json', () => {
      runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: requiredConfig });
    });
    it('should load default config into the generator', () => {
      expect(runResult.generator).toMatchObject(requiredConfig);
    });
  });
  describe('with custom prompt values', () => {
    let runResult;
    describe('and default options', () => {
      before(async () => {
        runResult = await contextBuilder().withPrompts(customPrompts).run();
      });
      it('should write expected config to .yo-rc.json', () => {
        runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: customPrompts });
      });
    });
    describe('and defaults option', () => {
      before(async () => {
        runResult = await contextBuilder().withOptions({ defaults: true }).withPrompts(customPrompts).run();
      });
      it('should write default config to .yo-rc.json', () => {
        runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: defaultConfig });
      });
    });
    describe('and skipPrompts option', () => {
      let runResult;
      before(async () => {
        runResult = await contextBuilder().withOptions({ skipPrompts: true }).withPrompts(customPrompts).run();
      });
      it('should write default config to .yo-rc.json', () => {
        runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: requiredConfig });
      });
    });
    describe('and existing config', () => {
      let runResult;
      before(async () => {
        runResult = await contextBuilder()
          .withOptions({ localConfig: { baseName: 'existing' } })
          .withPrompts(customPrompts)
          .run();
      });
      it('should not override default config to .yo-rc.json', () => {
        runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: { ...requiredConfig, baseName: 'existing' } });
      });
    });
    describe('and askAnswered option on an existing project', () => {
      let runResult;
      before(async () => {
        runResult = await contextBuilder()
          .withOptions({ askAnswered: true, localConfig: { baseName: 'existing' } })
          .withPrompts(customPrompts)
          .run();
      });
      it('should write expected config to .yo-rc.json', () => {
        runResult.assertJsonFileContent('.yo-rc.json', { [GENERATOR_JHIPSTER]: customPrompts });
      });
    });
  });
};

const testBlueprintSupport = generatorName => {
  const priorities = [
    'initializing',
    'prompting',
    'configuring',
    'composing',
    'loading',
    'preparing',
    'preparingFields',
    'preparingRelationships',
    'postWriting',
    'preConflicts',
    'writing',
    'install',
    'end',
  ];
  const addSpies = generator => {
    const prioritiesSpy = sinon.spy();
    let prioritiesCount = 0;
    priorities.forEach(priority => {
      if (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(generator), priority)) {
        prioritiesCount++;
      }
      generator[`_${priority}`] = prioritiesSpy;
    });
    return [prioritiesSpy, prioritiesCount];
  };
  describe('with blueprint', () => {
    let result;
    let spy;
    before(async () => {
      result = await helpers
        .run(path.join(__dirname, `../../generators/${generatorName}`))
        .withMockedGenerators([`jhipster-foo:${generatorName}`])
        .withOptions({ blueprint: 'foo', skipChecks: true })
        .on('ready', generator => {
          spy = addSpies(generator);
        });
    });
    it('should compose with blueprints', () => {
      expect(result.mockedGenerators[`jhipster-foo:${generatorName}`].callCount).toBe(1);
    });
    it('should not call any priority', () => {
      expect(spy[0].callCount).toBe(0);
    });
  });
  describe('with sbs blueprint', () => {
    let result;
    let spy;
    before(async () => {
      const context = helpers
        .run(path.join(__dirname, `../../generators/${generatorName}`))
        .withMockedGenerators([`jhipster-foo:${generatorName}`])
        .withOptions({ blueprint: 'foo', skipChecks: true })
        .on('ready', generator => {
          spy = addSpies(generator);
        });

      // simulate a sbs blueprint
      Object.defineProperty(context.mockedGenerators[`jhipster-foo:${generatorName}`].prototype, 'sbsBlueprint', {
        get() {
          return true;
        },
        enumerable: true,
        configurable: true,
      });

      result = await context;
    });
    it('should compose with blueprints', () => {
      expect(result.mockedGenerators[`jhipster-foo:${generatorName}`].callCount).toBe(1);
    });
    it('should not call any priority', () => {
      expect(spy[0].callCount).toBe(spy[1]);
    });
  });
};

module.exports = {
  basicTests,
  testBlueprintSupport,
  testOptions,
};
