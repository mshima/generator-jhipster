/**
 * Copyright 2013-2025 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { before, describe, esmocha, expect, it } from 'esmocha';
import { snakeCase } from 'lodash-es';

import EnvironmentBuilder from '../../cli/environment-builder.mjs';
import { defaultHelpers as helpers } from '../../lib/testing/index.js';
import { getCommandHelpOutput, shouldSupportFeatures } from '../../test/support/tests.js';
import BaseGenerator from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generator = basename(__dirname);

describe(`generator - ${generator}`, () => {
  it('generator-list constant matches folder name', async () => {
    await expect((await import('../generator-list.js'))[`GENERATOR_${snakeCase(generator).toUpperCase()}`]).toBe(generator);
  });
  shouldSupportFeatures(BaseGenerator);
  describe('help', () => {
    it('should print expected information', async () => {
      expect(await getCommandHelpOutput()).toMatchSnapshot();
    });
  });

  describe.skip('EnvironmentBuilder', () => {
    let envBuilder;
    before(() => {
      envBuilder = EnvironmentBuilder.createDefaultBuilder();
    });
    it(`should be registered as jhipster:${generator} at yeoman-environment`, async () => {
      expect(await envBuilder.getEnvironment().get(`jhipster:${generator}`)).toBe(BaseGenerator);
    });
  });

  describe('skipPriorities', () => {
    const initializing = esmocha.fn();
    const prompting = esmocha.fn();
    const writing = esmocha.fn();
    const postWriting = esmocha.fn();

    class CustomGenerator extends BaseGenerator {
      get [BaseGenerator.INITIALIZING]() {
        initializing();
        return {};
      }

      get [BaseGenerator.PROMPTING]() {
        prompting();
        return {};
      }

      get [BaseGenerator.WRITING]() {
        writing();
        return {};
      }

      get [BaseGenerator.POST_WRITING]() {
        postWriting();
        return {};
      }
    }

    before(async () => {
      await helpers
        .run(CustomGenerator as any)
        .withJHipsterGenerators({ useDefaultMocks: true })
        .withOptions({
          skipPriorities: ['prompting', 'writing', 'postWriting'],
        });
    });

    it('should skip priorities', async () => {
      expect(initializing).toBeCalled();
      expect(prompting).not.toBeCalled();
      expect(writing).not.toBeCalled();
      expect(postWriting).not.toBeCalled();
    });
  });
});
