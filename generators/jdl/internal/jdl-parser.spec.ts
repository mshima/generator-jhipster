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

import { convertJDL, createJDLParserRuntime } from './jdl-parser.ts';

describe('generator - jdl - convertJDL', () => {
  const runtime = createJDLParserRuntime();

  it('should give the files of a single application relative to the destination', () => {
    const { files } = convertJDL('application { config { baseName app } entities A }\nentity A', runtime);
    expect(Object.keys(files)).toEqual(['.yo-rc.json', '.jhipster/A.json']);
    expect(files['.yo-rc.json']['generator-jhipster'].applicationIndex).toBeUndefined();
  });

  it('should index the applications, the gateways first', () => {
    const { files } = convertJDL(
      `application { config { baseName ms applicationType microservice } }
application { config { baseName gw applicationType gateway } }`,
      runtime,
    );
    expect(files['ms/.yo-rc.json']['generator-jhipster'].applicationIndex).toBe(1);
    expect(files['gw/.yo-rc.json']['generator-jhipster'].applicationIndex).toBe(0);
  });

  it('should give a serviceClass service to the entities with a dto and no service', () => {
    const { files } = convertJDL(
      `application { config { baseName app } entities * }
entity A
entity B
entity C
entity D
dto A, B, C with mapstruct
service B with serviceImpl
dto D with no`,
      runtime,
    );
    expect(['A', 'B', 'C', 'D'].map(name => files[`.jhipster/${name}.json`].service)).toEqual([
      'serviceClass',
      'serviceImpl',
      'serviceClass',
      undefined,
    ]);
  });
});
