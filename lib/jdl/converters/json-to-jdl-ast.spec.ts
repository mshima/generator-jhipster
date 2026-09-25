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
import { readFileSync } from 'node:fs';

import { getDefaultRuntime } from '../../jdl-config/jdl-runtime.ts';
import { getTestFile } from '../core/__test-support__/index.ts';
import { groupStatements } from '../core/parsing/statements.ts';
import { printJDL } from '../core/printing/print-jdl.ts';
import type { JSONEntity } from '../core/types/json-config.ts';

import { createJDLASTBuilder } from './json-to-jdl-ast.ts';

const runtime = getDefaultRuntime();

const readJsonEntity = (...path: string[]): JSONEntity => JSON.parse(readFileSync(getTestFile(...path), 'utf-8'));
const readAppEntity = (entityName: string) => readJsonEntity('jhipster_app', '.jhipster', `${entityName}.json`);

const printEntities = (entities: Map<string, JSONEntity>) => printJDL(createJDLASTBuilder(runtime).addEntities(entities).build(), runtime);

/** The AST of the statements, as the parser groups them. */
const toAst = (builder: ReturnType<typeof createJDLASTBuilder>) => groupStatements(builder.build(), keyword => keyword);

describe('jdl - createJDLASTBuilder', () => {
  describe('addEntities', () => {
    it('should convert the entities, their fields, validations, enums, relationships and options', () => {
      const entities = new Map(
        ['Employee', 'Country', 'Department', 'JobHistory', 'Location', 'Region', 'Job', 'Task'].map(name => [name, readAppEntity(name)]),
      );
      expect(printEntities(entities)).toMatchInlineSnapshot(`
"/**
 * The Employee entity.
 */
entity Employee (emp) {
  employeeId Long
  /**
   * The firstname attribute.
   */
  firstName String
  lastName String
  email String
  phoneNumber String
  hireDate ZonedDateTime
  salary Long min(10000) max(1000000)
  commissionPct Long
}
entity Country (country) {
  /**
   * The country Id
   */
  countryId Long
  countryName String unique
}
entity Department (department) {
  departmentId Long
  departmentName String required
  description byte[]
  advertisement byte[]
  logo byte[]
}
entity JobHistory (job_history) {
  startDate ZonedDateTime
  endDate ZonedDateTime
  positionDuration Duration
  language Language
}
entity Location (location) {
  locationId Long
  streetAddress String
  postalCode String
  city String
  stateProvince String
}
entity Region (region) {
  regionId Long
  regionName String
}
entity Job (job) {
  jobId Long
  jobTitle String
  minSalary Long
  maxSalary Long
}
entity Task (task) {
  taskId Long
  title String
  description String
}

enum Language {
  FRENCH (french),
  ENGLISH,
  SPANISH
}

relationship OneToOne {
  Country{region} to Region{country} with builtInEntity
  Country{user} to User with builtInEntity
  Department{location} to Location
  JobHistory{job} to Job
  JobHistory{department} to Department{jobHistory}
  JobHistory{employee} to Employee
  Location{country} to Country
  Region{country} to Country{region}
}
relationship OneToMany {
  Employee{job} to Job{employee}
  /**
   * A relationship
   */
  Department{employee required} to Employee
}
relationship ManyToOne {
  /**
   * Another side of the same relationship
   */
  Employee{department(foo)} to
  /**
   * A relationship
   */
  Department{employee required}
  Employee{manager} to Employee
}
relationship ManyToMany {
  Department{jobHistory} to JobHistory{department}
  Job{task(title)} to Task{job required}
}

noFluentMethod Employee
dto Employee with mapstruct
pagination Employee, JobHistory with infinite-scroll
pagination Job with pagination
service Employee with serviceClass
search Employee with elasticsearch
angularSuffix Employee with myentities
microservice Employee with mymicroservice
filter Employee
readOnly Employee
embedded Employee
clientRootFolder Employee, Country, Department, JobHistory, Location, Region, Job, Task with toto
"
`);
    });

    it('should convert the options of the fields to annotations', () => {
      const entities = new Map<string, any>([
        [
          'TestEntity',
          {
            fields: [
              { fieldName: 'myId', fieldType: 'Long', options: { id: true } },
              { fieldName: 'customField', fieldType: 'String', options: { customAnnotation: 'customValue' } },
              { fieldName: 'noOptionsField', fieldType: 'String' },
            ],
            relationships: [],
          },
        ],
      ]);
      expect(toAst(createJDLASTBuilder(runtime).addEntities(entities)).entities[0].body!.map(field => field.annotations)).toEqual([
        [{ optionName: 'Id', type: 'UNARY' }],
        [{ optionName: 'CustomAnnotation', type: 'BINARY', optionValue: 'customValue' }],
        [],
      ]);
    });

    it('should take the options of a relationship from the entity of its right side', () => {
      const entities = new Map<string, any>([
        [
          'EntityA',
          {
            fields: [{ fieldName: 'name', fieldType: 'String' }],
            relationships: [
              {
                relationshipType: 'one-to-many',
                relationshipName: 'entityB',
                otherEntityName: 'entityB',
                relationshipSide: 'left',
                otherEntityRelationshipName: 'entityA',
              },
            ],
          },
        ],
        [
          'EntityB',
          {
            fields: [{ fieldName: 'name', fieldType: 'String' }],
            relationships: [
              {
                relationshipType: 'many-to-one',
                relationshipName: 'entityA',
                otherEntityName: 'entityA',
                relationshipSide: 'right',
                otherEntityRelationshipName: 'entityB',
                options: { destAnnotation: true },
              },
            ],
          },
        ],
      ]);
      expect(toAst(createJDLASTBuilder(runtime).addEntities(entities)).relationships).toEqual([
        {
          cardinality: 'OneToMany',
          from: { name: 'EntityA', injectedField: 'entityB', required: false, documentation: undefined },
          to: { name: 'EntityB', injectedField: 'entityA', required: false, documentation: undefined },
          options: { global: [], source: [], destination: [{ optionName: 'DestAnnotation', type: 'UNARY' }] },
        },
      ]);
    });

    it('should keep the relationships of the entities to the built-in User entity', () => {
      expect(printEntities(new Map([['Country', readAppEntity('Country')]]))).toContain('Country{user} to User with builtInEntity');
    });

    it('should convert an entity without relationship with its table name', () => {
      expect(printEntities(new Map([['CassBankAccount', readAppEntity('CassBankAccount')]]))).toContain(
        'entity CassBankAccount (cassBankAccount)',
      );
    });

    it('should convert the relationships to the built-in User and Authority entities', () => {
      expect(printEntities(new Map([['TestEntity', readJsonEntity('json_to_jdl_converter', 'with_user', '.jhipster', 'TestEntity.json')]])))
        .toMatchInlineSnapshot(`
"entity TestEntity

angularSuffix TestEntity with mySuffixAlt
filter TestEntity
"
`);
      expect(
        printEntities(new Map([['TestEntity', readJsonEntity('json_to_jdl_converter', 'with_authority', '.jhipster', 'TestEntity.json')]])),
      ).toMatchInlineSnapshot(`
"entity TestEntity

angularSuffix TestEntity with mySuffixAlt
filter TestEntity
"
`);
    });
  });

  describe('addApplication', () => {
    it('should keep the known options of an application, sorted, and replace an application added twice', () => {
      const ast = toAst(
        createJDLASTBuilder(runtime)
          .addApplication({
            baseName: 'tata',
            applicationType: 'monolith',
            unknownOption: 'foo',
            packageFolder: 'com/foo',
            entitySuffix: '',
          })
          .addApplication({ baseName: 'toto', applicationType: 'monolith' })
          .addApplication({ baseName: 'tata', applicationType: 'gateway' }),
      );
      expect(ast.applications.map(application => application.config)).toEqual([
        { applicationType: 'gateway', baseName: 'tata' },
        { applicationType: 'monolith', baseName: 'toto' },
      ]);
    });

    it('should name an application without base name jhipster', () => {
      expect(toAst(createJDLASTBuilder(runtime).addApplication({})).applications[0].config.baseName).toBe('jhipster');
    });

    it('should refuse a value an option does not accept', () => {
      expect(() => createJDLASTBuilder(runtime).addApplication({ applicationType: 'foo' })).toThrow(
        "The value 'foo' is not allowed for the option 'applicationType'.",
      );
    });

    it('should list the entities of the application', () => {
      const ast = toAst(createJDLASTBuilder(runtime).addApplication({ baseName: 'toto' }, new Map([['Region', readAppEntity('Region')]])));
      expect(ast.applications[0].entities).toEqual(['Region']);
      expect(ast.entities.map(entity => entity.name)).toEqual(['Region']);
    });
  });

  describe('addApplicationOptions', () => {
    it('should add the options applying to every entity', () => {
      const ast = toAst(createJDLASTBuilder(runtime).addApplicationOptions({ skipClient: true, skipServer: false }));
      expect(ast.options).toEqual({ skipClient: { list: ['*'], excluded: [] } });
    });

    it('should add nothing without options', () => {
      expect(toAst(createJDLASTBuilder(runtime).addApplicationOptions()).options).toEqual({});
    });
  });
});
