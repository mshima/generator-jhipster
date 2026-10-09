/**
 * Copyright 2013-2026 the original author or authors from the JHipster project.
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
import { before, describe, expect, it } from 'esmocha';
import { basename } from 'node:path';

import { defaultHelpers as helpers, runResult } from '../../lib/testing/index.ts';
import { shouldSupportFeatures } from '../../test/support/tests.ts';

import Generator from './index.ts';
import type InfoGenerator from './index.ts';

const generator = basename(import.meta.dirname);

describe(`generator - ${generator}`, () => {
  shouldSupportFeatures(Generator);

  describe('generateJDLFromEntities', () => {
    before(async () => {
      await helpers
        .runJHipster(generator)
        .withJHipsterConfig()
        .withFiles({
          // An entity of an old application, without a name.
          '.jhipster/Foo.json': {
            fields: [{ fieldName: 'name', fieldType: 'String', fieldValidateRules: ['required'] }],
            relationships: [],
          },
        })
        .commitFiles()
        .withOptions({ skipPriorities: ['initializing'] });
    });

    it('should give the jdl of the entities', () => {
      expect((runResult.generator as unknown as InfoGenerator).generateJDLFromEntities()).toMatchInlineSnapshot(`
"entity Foo {
  name String required
}
"
`);
    });
  });
});
