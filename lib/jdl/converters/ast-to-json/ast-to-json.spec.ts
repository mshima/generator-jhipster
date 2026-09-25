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
import performJDLPostParsingTasks from '../../core/parsing/jdl-post-parsing-tasks.ts';

import { type ImportTarget, astToJson } from './ast-to-json.ts';

const runtime = getDefaultRuntime();

const convert = (jdl: string, target: ImportTarget = {}) =>
  astToJson(performJDLPostParsingTasks(parse(jdl, runtime, { onWarning: () => {} })), target, runtime);

describe('jdl - astToJson', () => {
  describe('without application', () => {
    it('should convert the entities, for every application', () => {
      const { entities, applications } = convert(`
/** An entity. */
@ChangelogDate("20200101000000")
entity A (a_table) {
  /** A name. */
  name String required pattern(/[a-z']+/)
  size Integer min(MIN)
  kind Kind
}
MIN = 2
/** A kind. */
enum Kind {
  /** One. */
  ONE (one),
  TWO
}
`);
      expect(applications).toEqual([]);
      expect(entities).toMatchInlineSnapshot(`
[
  {
    "angularJSSuffix": undefined,
    "annotations": {
      "changelogDate": "20200101000000",
    },
    "applications": [
      "*",
    ],
    "clientRootFolder": undefined,
    "documentation": "An entity.",
    "dto": undefined,
    "embedded": undefined,
    "entityTableName": "a_table",
    "fields": [
      {
        "documentation": "A name.",
        "fieldName": "name",
        "fieldType": "String",
        "fieldValidateRules": [
          "required",
          "pattern",
        ],
        "fieldValidateRulesPattern": "[a-z\\']+",
      },
      {
        "fieldName": "size",
        "fieldType": "Integer",
        "fieldValidateRules": [
          "min",
        ],
        "fieldValidateRulesMin": "2",
      },
      {
        "fieldName": "kind",
        "fieldType": "Kind",
        "fieldTypeDocumentation": "A kind.",
        "fieldValues": "ONE (one),TWO",
        "fieldValuesJavadocs": {
          "ONE": "One.",
        },
      },
    ],
    "fluentMethods": undefined,
    "jpaMetamodelFiltering": undefined,
    "microserviceName": undefined,
    "name": "A",
    "pagination": undefined,
    "readOnly": undefined,
    "relationships": [],
    "service": undefined,
    "skipClient": undefined,
    "skipServer": undefined,
  },
]
`);
    });

    it('should give the entities of a microservice its name and client root folder', () => {
      const { entities } = convert('entity A\nentity B\nmicroservice B with other', {
        applicationName: 'ms',
        applicationType: 'microservice',
      });
      expect(entities!.map(({ name, microserviceName, clientRootFolder }) => ({ name, microserviceName, clientRootFolder }))).toEqual([
        { name: 'A', microserviceName: undefined, clientRootFolder: 'ms' },
        { name: 'B', microserviceName: 'other', clientRootFolder: 'ms' },
      ]);
    });
  });

  describe('relationships', () => {
    it('should make a relationship without injected field bidirectional', () => {
      const { entities } = convert('entity A\nentity B\nrelationship OneToMany { A to B }');
      expect(entities!.map(entity => entity.relationships)).toEqual([
        [
          {
            relationshipSide: 'left',
            relationshipType: 'one-to-many',
            otherEntityName: 'b',
            otherEntityRelationshipName: 'a',
            relationshipName: 'b',
          },
        ],
        [
          {
            relationshipSide: 'right',
            relationshipType: 'many-to-one',
            otherEntityName: 'a',
            otherEntityRelationshipName: 'b',
            relationshipName: 'a',
          },
        ],
      ]);
    });

    it('should convert the options, the required sides and the built-in entities', () => {
      const { entities } = convert(`
entity A
relationship ManyToOne {
  @OnDelete("CASCADE") A{user(login) required} to @Other User with builtInEntity
}
`);
      expect(entities![0].relationships).toEqual([
        {
          relationshipSide: 'left',
          relationshipType: 'many-to-one',
          otherEntityName: 'user',
          relationshipValidateRules: 'required',
          relationshipName: 'user',
          otherEntityField: 'login',
          options: { other: true },
          relationshipWithBuiltInEntity: true,
        },
      ]);
    });

    it('should order the relationships by type, a relationship written twice once', () => {
      const { entities } = convert(`
entity A
entity B
relationship ManyToMany { A{b} to B{a} }
relationship OneToOne { A{c} to B }
relationship ManyToMany { A{b} to B{a} }
`);
      expect(entities![0].relationships.map(relationship => relationship.relationshipType)).toEqual(['one-to-one', 'many-to-many']);
    });
  });

  describe('with applications', () => {
    it('should convert each application and its entities', () => {
      const { applications, entitiesPerApplication, entities } = convert(`
application {
  config {
    baseName one
    languages [en, fr, en]
    blueprints [foo]
  }
  config(foo) {
    port 8080
  }
  entities A
  dto * with mapstruct
}
application {
  config { baseName two }
}
application {
  config { baseName three }
  entities A, B
}
entity A
entity B
paginate * with pagination
`);
      expect(entities).toBeUndefined();
      expect(applications).toMatchInlineSnapshot(`
[
  {
    "generator-jhipster": {
      "baseName": "one",
      "blueprints": [
        {
          "name": "foo",
        },
      ],
      "entities": [
        "A",
      ],
      "languages": [
        "en",
        "fr",
      ],
      "microfrontends": undefined,
    },
    "namespaceConfigs": {
      "foo": {
        "port": 8080,
      },
    },
  },
  {
    "generator-jhipster": {
      "baseName": "two",
      "blueprints": undefined,
      "entities": [],
      "microfrontends": undefined,
    },
  },
  {
    "generator-jhipster": {
      "baseName": "three",
      "blueprints": undefined,
      "entities": [
        "A",
        "B",
      ],
      "microfrontends": undefined,
    },
  },
]
`);
      // The applications without entities come last.
      expect([...entitiesPerApplication.keys()]).toEqual(['one', 'three', 'two']);
      const [a] = entitiesPerApplication.get('one')!;
      expect(a).toMatchObject({ name: 'A', dto: 'mapstruct', pagination: 'pagination', applications: ['one', 'three'] });
      expect(entitiesPerApplication.get('three')!.map(entity => entity.name)).toEqual(['A', 'B']);
    });
  });

  describe('deployments', () => {
    it('should give a deployment the defaults of its type', () => {
      const { deployments } = convert('deployment { deploymentType docker-compose appsFolders [one, two, one] }');
      expect(deployments).toMatchInlineSnapshot(`
[
  {
    "generator-jhipster": {
      "appsFolders": [
        "one",
        "two",
      ],
      "clusteredDbApps": [],
      "deploymentType": "docker-compose",
      "directoryPath": "../",
      "gatewayType": "SpringCloudGateway",
      "monitoring": "no",
      "serviceDiscoveryType": "consul",
    },
  },
]
`);
    });
  });
});
