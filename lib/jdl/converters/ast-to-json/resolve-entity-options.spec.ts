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

import { getDefaultRuntime } from '../../../jdl-config/jdl-runtime.ts';
import { parse } from '../../core/parsing/api.ts';

import { collectOptionStatements, resolveEntityOptions } from './resolve-entity-options.ts';

const runtime = getDefaultRuntime();

const resolve = (jdl: string, entityNames = ['A', 'B', 'C']) => {
  const ast = parse(jdl, runtime, { onWarning: () => {} });
  return Object.fromEntries(resolveEntityOptions(collectOptionStatements(ast.options, ast.useOptions), entityNames));
};

describe('jdl - resolveEntityOptions', () => {
  it('should give every entity but the excluded ones the option of a * statement', () => {
    expect(resolve('dto * with mapstruct except B')).toEqual({
      A: { dto: 'mapstruct', service: 'serviceClass' },
      C: { dto: 'mapstruct', service: 'serviceClass' },
    });
  });

  it('should name the json attributes of the options', () => {
    expect(
      resolve(`
noFluentMethod A
filter A
readOnly A
embedded A
skipClient A
skipServer A
search A with elasticsearch
angularSuffix A with suffix
microservice A with ms
clientRootFolder A with folder
paginate A with pagination
`),
    ).toMatchInlineSnapshot(`
{
  "A": {
    "angularJSSuffix": "suffix",
    "clientRootFolder": "folder",
    "embedded": true,
    "fluentMethods": false,
    "jpaMetamodelFiltering": true,
    "microserviceName": "ms",
    "pagination": "pagination",
    "readOnly": true,
    "searchEngine": "elasticsearch",
    "service": "serviceClass",
    "skipClient": true,
    "skipServer": true,
  },
}
`);
  });

  it('should keep the service an entity using a dto has', () => {
    expect(resolve('service A with serviceImpl\ndto A, B with mapstruct')).toEqual({
      A: { service: 'serviceImpl', dto: 'mapstruct' },
      B: { dto: 'mapstruct', service: 'serviceClass' },
    });
  });

  it('should not search the entities excluded from a search statement', () => {
    expect(resolve('search * with elasticsearch except C')).toEqual({
      A: { searchEngine: 'elasticsearch' },
      B: { searchEngine: 'elasticsearch' },
      C: { searchEngine: 'no' },
    });
  });

  it('should apply the use statements after the option statements', () => {
    expect(resolve('use mapstruct, serviceImpl, infinite-scroll for A\nservice A with serviceClass')).toEqual({
      A: { service: 'serviceImpl', dto: 'mapstruct', pagination: 'infinite-scroll' },
    });
  });

  it('should apply the statements passed first before those of the jdl', () => {
    const ast = parse('microservice B with other', runtime, { onWarning: () => {} });
    const first = [{ name: 'microservice', value: 'ms', entityNames: new Set(['*']), excludedNames: new Set<string>() }];
    expect(Object.fromEntries(resolveEntityOptions(collectOptionStatements(ast.options, ast.useOptions, first), ['A', 'B']))).toEqual({
      A: { microserviceName: 'ms' },
      B: { microserviceName: 'other' },
    });
  });
});
