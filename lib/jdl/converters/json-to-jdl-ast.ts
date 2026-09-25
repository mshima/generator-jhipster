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

import { lowerFirst, upperFirst } from 'lodash-es';

import { asJdlRelationshipType } from '../core/basic-types/relationship-types.ts';
import { binaryOptions, relationshipOptions, unaryOptions } from '../core/built-in-options/index.ts';
import type { JDLRelationshipType } from '../core/parsing/relationship-types.ts';
import { type JDLApplicationStatement, type JDLStatement, setStatements } from '../core/parsing/statements.ts';
import type {
  ParsedJDLAnnotation,
  ParsedJDLApplicationDeclaration,
  ParsedJDLEntity,
  ParsedJDLEntityField,
  ParsedJDLEnum,
  ParsedJDLEnumValue,
  ParsedJDLOptionConfig,
  ParsedJDLRelationship,
  ParsedJDLRelationshipSide,
} from '../core/parsing/types/parsed.ts';
import type { JDLRuntime } from '../core/parsing/types/runtime.ts';
import type { JSONEntity, JSONField, JSONRelationship } from '../core/types/json-config.ts';

const { BUILT_IN_ENTITY } = relationshipOptions;
const { FILTER, NO_FLUENT_METHOD, READ_ONLY, EMBEDDED, SKIP_CLIENT, SKIP_SERVER } = unaryOptions;
const { ANGULAR_SUFFIX, CLIENT_ROOT_FOLDER, DTO, MICROSERVICE, PAGINATION, SEARCH, SERVICE } = binaryOptions.Options;

/** The order the relationships are kept in: by type, then in the order they are added. */
const RELATIONSHIP_TYPES = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'];

/** The application options that are not written to a jdl: the package folder is derived from the package name. */
const NOT_EXPORTED_OPTIONS = ['packageFolder'];

type OptionsAST = Record<string, ParsedJDLOptionConfig | Record<string, ParsedJDLOptionConfig>>;

/**
 * Builds the AST of a jdl from JSON configurations, the `generator-jhipster` content of `.yo-rc.json` files and the
 * `.jhipster` entity files, so it can be printed back to a jdl. An application, an entity, an enum or a relationship
 * added twice replaces the first one, keeping its place; the entities of an option are merged.
 */
export function createJDLASTBuilder(runtime: JDLRuntime) {
  const applications = new Map<string, ParsedJDLApplicationDeclaration>();
  const entities = new Map<string, ParsedJDLEntity>();
  const enums = new Map<string, ParsedJDLEnum>();
  const relationships = new Map<string, Map<string, ParsedJDLRelationship>>(RELATIONSHIP_TYPES.map(type => [type, new Map()]));
  const options: OptionsAST = {};

  const addUnaryOption = (name: string, entityName: string) => {
    const option = (options[name] ??= { list: [], excluded: [] }) as ParsedJDLOptionConfig;
    if (!option.list.includes(entityName)) option.list.push(entityName);
  };

  const addBinaryOption = (name: string, value: string, entityName: string) => {
    const values = (options[name] ??= {}) as Record<string, ParsedJDLOptionConfig>;
    const option = (values[value] ??= { list: [], excluded: [] });
    if (!option.list.includes(entityName)) option.list.push(entityName);
  };

  const addEntityOptions = (entity: JSONEntity, entityName: string) => {
    if (entity.fluentMethods === false) {
      addUnaryOption(NO_FLUENT_METHOD, entityName);
    }
    for (const option of [DTO, PAGINATION, SERVICE]) {
      if (entity[option] && entity[option] !== 'no') {
        addBinaryOption(option, entity[option], entityName);
      }
    }
    if (entity.searchEngine) {
      addBinaryOption(SEARCH, entity.searchEngine, entityName);
    }
    // angularSuffix in the jdl, angularJSSuffix in the json
    if (entity.angularJSSuffix) {
      addBinaryOption(ANGULAR_SUFFIX, entity.angularJSSuffix, entityName);
    }
    // microservice in the jdl, microserviceName in the json
    if (entity.microserviceName !== undefined) {
      addBinaryOption(MICROSERVICE, entity.microserviceName, entityName);
    }
    if (entity.jpaMetamodelFiltering) {
      addUnaryOption(FILTER, entityName);
    }
    if (entity.readOnly) {
      addUnaryOption(READ_ONLY, entityName);
    }
    if (entity.embedded) {
      addUnaryOption(EMBEDDED, entityName);
    }
    if (entity.clientRootFolder) {
      addBinaryOption(CLIENT_ROOT_FOLDER, entity.clientRootFolder, entityName);
    }
  };

  const addRelationship = (relationship: ParsedJDLRelationship) => {
    const { cardinality, from, to } = relationship;
    const side = ({ name, injectedField }: ParsedJDLRelationshipSide) => `${name}${injectedField ? `{${injectedField}}` : ''}`;
    if (!relationships.has(cardinality)) relationships.set(cardinality, new Map());
    relationships.get(cardinality)!.set(`${side(from)}_${side(to)}`, relationship);
  };

  const builder = {
    /** Adds an application, and its entities when they are passed. */
    addApplication(config: Record<string, any>, applicationEntities?: Map<string, JSONEntity>) {
      const application = convertApplication(config, runtime);
      applications.set(application.config.baseName, application);
      const statements: JDLApplicationStatement[] = [{ type: 'config', config: application.config }];
      if (applicationEntities) {
        builder.addEntities(applicationEntities);
        application.entities = [...applicationEntities.keys()];
        application.entitiesOptions = { entityList: application.entities, excluded: [] };
        if (application.entities.length > 0) {
          statements.push({ type: 'entities', entities: application.entitiesOptions });
        }
      }
      setStatements(application, statements);
      return builder;
    },

    /** Adds entities, keyed by their names, with their enums, options and relationships. */
    addEntities(jsonEntities: Map<string, JSONEntity>) {
      jsonEntities.forEach((entity, entityName) => {
        entities.set(entityName, convertEntity(entity, entityName));
        for (const jdlEnum of convertEnums(entity)) {
          enums.set(jdlEnum.name, jdlEnum);
        }
        addEntityOptions(entity, entityName);
      });
      jsonEntities.forEach((entity, entityName) => {
        for (const relationship of entity.relationships ?? []) {
          // The right side is merged into the left one.
          if (relationship.relationshipSide === 'right') continue;
          const converted = convertRelationship(relationship, entityName, jsonEntities);
          if (converted) addRelationship(converted);
        }
      });
      return builder;
    },

    /** Adds the options of an application that apply to every entity. */
    addApplicationOptions(config: Record<string, any> = {}) {
      for (const option of [SKIP_CLIENT, SKIP_SERVER]) {
        if (config[option] === true) {
          addUnaryOption(option, '*');
        }
      }
      return builder;
    },

    /**
     * The statements of the jdl, in the canonical order of an exported jdl: the applications, the entities, the enums,
     * a relationship block per type, then the option statements.
     */
    build(): JDLStatement[] {
      // An option statement is written with the current keyword of the option.
      const keyword = (name: string) => runtime.entityDefinition.configs[name]?.jdl.keyword ?? name;
      const optionStatements: JDLStatement[] = Object.entries(options).flatMap(([name, option]) =>
        Array.isArray((option as ParsedJDLOptionConfig).list) ?
          [{ type: 'option' as const, option: { optionName: keyword(name), ...(option as ParsedJDLOptionConfig) } }]
        : Object.entries(option as Record<string, ParsedJDLOptionConfig>).map(([optionValue, valueOption]) => ({
            type: 'option' as const,
            option: { optionName: keyword(name), optionValue, ...valueOption },
          })),
      );
      return [
        ...[...applications.values()].map(application => ({ type: 'application' as const, application })),
        ...[...entities.values()].map(entity => ({ type: 'entity' as const, entity })),
        ...[...enums.values()].map(jdlEnum => ({ type: 'enum' as const, enum: jdlEnum })),
        ...[...relationships.entries()]
          .filter(([, ofType]) => ofType.size > 0)
          .map(([cardinality, ofType]) => ({
            type: 'relationships' as const,
            cardinality: cardinality as JDLRelationshipType,
            relationships: [...ofType.values()],
          })),
        ...optionStatements,
      ];
    },
  };
  return builder;
}

function convertApplication(jsonConfig: Record<string, any>, runtime: JDLRuntime): ParsedJDLApplicationDeclaration {
  const { applicationDefinition } = runtime;
  const config: Record<string, any> = {};
  for (const [name, value] of Object.entries({ baseName: 'jhipster', ...jsonConfig })) {
    if (!applicationDefinition.doesOptionExist(name) || NOT_EXPORTED_OPTIONS.includes(name)) continue;
    if ((Array.isArray(value) || typeof value === 'string') && !applicationDefinition.doesOptionValueExist(name, value)) {
      throw new Error(`The value '${value}' is not allowed for the option '${name}'.`);
    }
    config[name] = value;
  }
  if (!config.entitySuffix) {
    delete config.entitySuffix;
  }
  const sortedConfig = Object.fromEntries(
    Object.keys(config)
      .sort()
      .map(name => [name, config[name]]),
  );
  return {
    config: sortedConfig as ParsedJDLApplicationDeclaration['config'],
    namespaceConfigs: {},
    entities: [],
    entitiesOptions: { entityList: [], excluded: [] },
    options: {},
    useOptions: [],
  };
}

function convertAnnotations(annotations: Record<string, any> | undefined): ParsedJDLAnnotation[] {
  return Object.entries(annotations ?? {}).map(([name, value]) =>
    value === undefined || value === null || value === true ?
      { optionName: upperFirst(name), type: 'UNARY' }
    : { optionName: upperFirst(name), type: 'BINARY', optionValue: value },
  );
}

function convertEntity(entity: JSONEntity, entityName: string): ParsedJDLEntity {
  return {
    name: entityName,
    tableName: entity.entityTableName,
    documentation: entity.documentation,
    annotations: convertAnnotations(entity.annotations),
    body: (entity.fields ?? []).map(field => convertField(field)),
  };
}

function convertField(field: JSONField): ParsedJDLEntityField {
  return {
    name: lowerFirst(field.fieldName),
    type: field.fieldType,
    documentation: field.documentation,
    annotations: convertAnnotations(field.options),
    validations: (field.fieldValidateRules ?? []).map((rule: string) => ({
      key: rule,
      value: field[`fieldValidateRules${upperFirst(rule)}`],
    })),
  };
}

function convertEnums(entity: JSONEntity): ParsedJDLEnum[] {
  return (entity.fields ?? [])
    .filter(field => field.fieldValues !== undefined)
    .map(field => ({ name: field.fieldType, values: convertEnumValues(field.fieldValues!), documentation: field.fieldTypeDocumentation }));
}

function convertEnumValues(values: string): ParsedJDLEnumValue[] {
  return values.split(',').map(fieldValue => {
    // if fieldValue looks like ENUM_VALUE (something)
    if (fieldValue.includes('(')) {
      const [key, value] = fieldValue
        .replace(/^(\w+)\s\((\w+)\)$/, (_match, matchedKey, matchedValue) => `${matchedKey},${matchedValue}`)
        .split(',');
      return value === undefined ? { key } : { key, value };
    }
    return { key: fieldValue };
  });
}

/** The field a relationship injects, with the field of the other entity it displays when it is not the id. */
function injectedField({ relationshipName, otherEntityField }: JSONRelationship): string {
  return relationshipName + (otherEntityField && otherEntityField !== 'id' ? `(${otherEntityField})` : '');
}

function convertRelationship(
  relationship: JSONRelationship,
  entityName: string,
  jsonEntities: Map<string, JSONEntity>,
): ParsedJDLRelationship | undefined {
  const global: ParsedJDLAnnotation[] = relationship.relationshipWithBuiltInEntity ? [{ optionName: BUILT_IN_ENTITY, type: 'UNARY' }] : [];
  const destinationEntityName = upperFirst(relationship.otherEntityName);
  const destinationEntity = jsonEntities.get(destinationEntityName);
  if (!destinationEntity && global.length === 0) {
    return undefined;
  }
  const destinationSide = destinationEntity?.relationships?.find(
    destinationRelationship =>
      upperFirst(destinationRelationship.otherEntityName) === entityName &&
      destinationRelationship.otherEntityRelationshipName === relationship.relationshipName,
  );
  return {
    cardinality: asJdlRelationshipType(relationship.relationshipType),
    from: {
      name: entityName,
      injectedField: injectedField(relationship),
      required: !!relationship.relationshipValidateRules,
      documentation: relationship.documentation,
    },
    to: {
      name: destinationEntityName,
      injectedField: destinationSide ? injectedField(destinationSide) : null,
      required: !!destinationSide?.relationshipValidateRules,
      documentation: destinationSide?.documentation,
    } as ParsedJDLRelationshipSide,
    options: {
      global,
      source: convertAnnotations(relationship.options),
      destination: convertAnnotations(destinationSide?.options),
    },
  };
}
