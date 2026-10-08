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
import { describe, expect, it } from 'esmocha';

import { type JDLConvertibleDefinitions, convertJDLDefinitions, createRuntime, parseJDL } from 'jdl-parser';
import { jhipsterSemanticRules } from 'jdl-parser/jhipster';

import { getDefaultJDLDefinitions as getGeneratorJDLDefinitions } from '../jdl-config/jdl-runtime.ts';

import { buildJDLConfigDefinition, getDefaultJDLDefinitions } from './definitions.ts';

const withoutDescriptions = (configs: Record<string, { description?: string }>) =>
  Object.fromEntries(Object.entries(configs).map(([name, { description: _description, ...config }]) => [name, config]));

describe('jdl-parser - definitions', () => {
  const definitions = getDefaultJDLDefinitions();
  const converted = convertJDLDefinitions(getGeneratorJDLDefinitions() as unknown as JDLConvertibleDefinitions);

  it('should give the definitions of generator-jhipster in the format of jdl-parser', () => {
    for (const key of ['application', 'deployment'] as const) {
      expect(Object.keys(definitions[key].configs)).toEqual(Object.keys(converted[key].configs));
      expect(withoutDescriptions(definitions[key].configs)).toEqual(converted[key].configs);
    }
    expect(definitions.entity).toEqual(converted.entity);
    expect(definitions.validation).toEqual(converted.validation);
    expect(definitions.fieldTypes).toEqual(converted.fieldTypes);
  });

  it('should give the semantic rules of JHipster of jdl-parser', () => {
    expect(definitions.rules).toBe(jhipsterSemanticRules);
  });

  it('should make a runtime parsing a jdl of JHipster', () => {
    const jdl = 'application { config { baseName jhipster applicationType monolith } entities A }\nentity A\ndto A with mapstruct';
    expect(parseJDL(jdl, createRuntime(definitions)).diagnostics).toEqual([]);
  });

  it('should describe the options of command configs', () => {
    expect(
      buildJDLConfigDefinition({
        baseName: {
          description: 'Application name',
          jdl: { type: 'string', tokenType: 'NAME', tokenValuePattern: /^\w+$/ },
          scope: 'storage',
        },
        clientFramework: {
          choices: ['angular', { value: 'react', name: 'React' }],
          jdl: { type: 'string', tokenType: 'NAME' },
          scope: 'storage',
        },
        jhipsterVersion: {
          jdl: { type: 'string', tokenType: 'NAME', quoted: true, deprecated: 'stamped by the generator' },
          scope: 'storage',
        },
        skipClient: { cli: { type: Boolean }, scope: 'storage' },
      }),
    ).toEqual({
      configs: {
        baseName: { description: 'Application name', jdl: { type: 'name', pattern: /^\w+$/ } },
        clientFramework: { choices: ['angular', 'react'], jdl: { type: 'name' } },
        jhipsterVersion: { deprecated: 'stamped by the generator', jdl: { type: 'string' } },
      },
    });
  });
});
