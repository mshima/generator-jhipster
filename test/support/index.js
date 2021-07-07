const expect = require('expect');
const path = require('path');
const sinon = require('sinon');

const { skipPrettierHelpers: helpers } = require('../utils/utils');

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
  testBlueprintSupport,
};
