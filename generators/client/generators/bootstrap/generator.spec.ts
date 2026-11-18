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
import { before, describe, expect, it } from 'expect-node';
import { basename, resolve } from 'node:path';

import { testBootstrapEntities } from '../../../../test/support/bootstrap-tests.ts';
import type { Entity as ClientEntity } from '../../types.d.ts';

import Generator from './generator.ts';

import { shouldSupportFeatures } from '#test-support';
import { defaultHelpers as helpers, runResult } from '#testing';

const generator = `${basename(resolve(import.meta.dirname, '../../'))}:${basename(import.meta.dirname)}`;

describe(`generator - ${generator}`, () => {
  shouldSupportFeatures(Generator);

  it('bootstrap migration', async () => {
    await helpers
      .runJHipster('jhipster:bootstrap-application-client')
      .prepareEnvironment()
      .withMockedGenerators(['jhipster:client:bootstrap']);
    expect(runResult.getComposedGenerators()).toContain('jhipster:client:bootstrap');
  });

  describe('filterEntitiesAndPropertiesForClient', () => {
    // A field the clients skip, which the entity files declare.
    const hiddenField = { fieldName: 'hidden', fieldType: 'String', skipClient: true };

    before(async () => {
      await helpers
        .runJHipster(generator)
        .withJHipsterConfig({}, [{ name: 'Foo', fields: [{ fieldName: 'shown', fieldType: 'String' }, hiddenField] }]);
    });

    it('should leave out the fields the clients skip', () => {
      const { application, entities } = runResult;
      const [foo] = application!.filterEntitiesAndPropertiesForClient!([entities!.Foo as ClientEntity]);
      expect(foo.fields.map(field => field.fieldName)).toEqual(['id', 'shown']);
    });
    it('should keep the fields of the entity', () => {
      expect(runResult.entities!.Foo.fields!.map(field => field.fieldName)).toEqual(['id', 'shown', 'hidden']);
    });
  });

  describe('clientEntities', () => {
    const anyFieldProperties = (entity: ClientEntity) =>
      Object.fromEntries(Object.entries(entity).filter(([key, value]) => key.startsWith('anyField') && value));
    const clientEntity = (name: string) => runResult.application!.clientEntities!.find(entity => entity.name === name)!;
    // The only fields of their type, the entity of the clients giving none of their anyField properties.
    const skippedFields = [
      { fieldName: 'secret', fieldType: 'Hidden', fieldValues: 'ALPHA,BETA', skipClient: true },
      { fieldName: 'moment', fieldType: 'Instant', skipClient: true },
      { fieldName: 'picture', fieldType: 'ImageBlob', skipClient: true },
      { fieldName: 'noted', fieldType: 'String', documentation: 'A note', skipClient: true },
    ];

    before(async () => {
      await helpers.runJHipster(generator).withJHipsterConfig({}, [
        {
          name: 'Foo',
          fields: [
            { fieldName: 'shown', fieldType: 'String' },
            { fieldName: 'color', fieldType: 'Color', fieldValues: 'RED,GREEN' },
            ...skippedFields,
          ],
        },
        {
          name: 'Bar',
          fields: [
            { fieldName: 'picture', fieldType: 'ImageBlob' },
            { fieldName: 'day', fieldType: 'LocalDate' },
          ],
        },
        { name: 'Baz', skipClient: true, fields: [{ fieldName: 'name', fieldType: 'String' }] },
      ]);
    });

    it('should prepare the entities the clients write', () => {
      expect(runResult.application!.clientEntities!.map(entity => entity.name)).toEqual(expect.arrayContaining(['Foo', 'Bar']));
      expect(runResult.application!.clientEntities!.map(entity => entity.name)).not.toContain('Baz');
    });
    it('should give the client entities from the filter', () => {
      const { application, entities } = runResult;
      const [foo, bar] = application!.filterEntitiesAndPropertiesForClient!([
        entities!.Foo as ClientEntity,
        entities!.Bar as ClientEntity,
        entities!.Baz as ClientEntity,
      ]);
      expect(foo).toBe(clientEntity('Foo'));
      expect(bar).toBe(clientEntity('Bar'));
    });
    it('should leave out the fields the clients skip', () => {
      expect(clientEntity('Foo').fields.map(field => field.fieldName)).toEqual(['id', 'shown', 'color']);
      expect((runResult.entities!.Foo as ClientEntity).clientFields!.map(field => field.fieldName)).toEqual(['id', 'shown', 'color']);
    });
    it('should list the values of the enums of the fields the clients keep only', () => {
      expect((runResult.entities!.Foo as ClientEntity).enumTypeFields!.map(field => field.fieldName)).toEqual(['color']);
    });
    it('should derive the anyField properties from the fields that are left', () => {
      expect(anyFieldProperties(clientEntity('Foo'))).toEqual({});
      expect(anyFieldProperties(runResult.entities!.Foo as ClientEntity)).toEqual({
        anyFieldHasDocumentation: true,
        anyFieldHasFileBasedContentType: true,
        anyFieldHasImageContentType: true,
        anyFieldIsBlobDerived: true,
        anyFieldIsDateDerived: true,
        anyFieldIsInstant: true,
        anyFieldIsTimeDerived: true,
      });
    });
    it('should keep the anyField properties of an entity the clients skip no field of', () => {
      expect(clientEntity('Bar').fields.map(field => field.fieldName)).toEqual(['id', 'picture', 'day']);
      expect(anyFieldProperties(clientEntity('Bar'))).toEqual(anyFieldProperties(runResult.entities!.Bar as ClientEntity));
      expect(clientEntity('Bar').anyFieldHasImageContentType).toBe(true);
    });
  });

  describe('withAdminUi', () => {
    const run = (config: Record<string, unknown>) => helpers.runJHipster(generator).withJHipsterConfig(config);

    it('should default to true with a Spring Boot backend', async () => {
      await run({});
      expect(runResult.application?.withAdminUi).toBe(true);
    });

    it('should default to false with another backend', async () => {
      await run({ backendType: 'Other' });
      expect(runResult.application?.withAdminUi).toBe(false);
    });

    it('should keep the value set for another backend', async () => {
      await run({ backendType: 'Other', withAdminUi: true });
      expect(runResult.application?.withAdminUi).toBe(true);
    });

    it('should default to false in a microservice', async () => {
      await run({ applicationType: 'microservice' });
      expect(runResult.application?.withAdminUi).toBe(false);
    });
  });

  describe('prettierFolders', () => {
    const prettierFoldersFor = async (config: Record<string, unknown>, application: Record<string, unknown> = {}) => {
      await helpers.runJHipster(generator).withSharedApplication(application).withJHipsterConfig(config);
      return runResult.application!.prettierFolders;
    };

    it('should format the sources of the client', async () => {
      expect(await prettierFoldersFor({ clientFramework: 'angular' })).toContain('src/main/webapp/**/');
      expect(await prettierFoldersFor({ clientFramework: 'angular', clientRootDir: 'client/' })).toContain('client/src/**/');
    });

    it('should not format them without a client', async () => {
      expect(await prettierFoldersFor({ clientFramework: 'no' })).not.toContain('src/main/webapp/**/');
    });

    it('should not add the sources a folder already formats', async () => {
      expect(await prettierFoldersFor({ clientFramework: 'angular' }, { prettierFolders: ['', 'src/**/'] })).toEqual(['', 'src/**/']);
    });
  });

  describe('with', () => {
    describe('default config', () => {
      before(async () => {
        await helpers.runJHipster(generator).withJHipsterConfig();
      });

      it('should succeed - snapshot', () => {
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
{
  ".yo-rc.json": {
    "contents": "{
  "generator-jhipster": {
    "baseName": "jhipster",
    "creationTimestamp": 1577836800000,
    "entities": []
  }
}
",
    "stateCleared": "modified",
  },
}
`);
      });
    });
  });

  testBootstrapEntities(generator);
});
