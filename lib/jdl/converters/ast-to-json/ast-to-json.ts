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

import { capitalize, kebabCase, lowerFirst, upperFirst } from 'lodash-es';

import { APPLICATION_TYPE_MICROSERVICE, type ApplicationType } from '../../../core/application-types.ts';
import { getDefaultJDLDeploymentDefaults } from '../../../jdl-config/jhipster-jdl-config.ts';
import type { YoRcJHipsterDeploymentContent } from '../../../jhipster/types/yo-rc.ts';
import { customCamelCase } from '../../../utils/string-utils.ts';
import { asJdlRelationshipType } from '../../core/basic-types/relationship-types.ts';
import type { RelationshipType } from '../../core/basic-types/relationships.ts';
import { binaryOptions, relationshipOptions, validations } from '../../core/built-in-options/index.ts';
import type {
  ParsedJDLAnnotation,
  ParsedJDLApplication,
  ParsedJDLApplications,
  ParsedJDLDeployment,
  ParsedJDLEntity,
  ParsedJDLEntityField,
  ParsedJDLEnum,
  ParsedJDLRelationship,
  ParsedJDLValidation,
} from '../../core/parsing/types/parsed.ts';
import type { JDLRuntime } from '../../core/parsing/types/runtime.ts';
import type { PostProcessedJDLJSONApplication } from '../../core/types/exporter.ts';
import type { JSONField, JSONRelationship } from '../../core/types/json-config.ts';
import { formatComment } from '../../core/utils/format-utils.ts';

import { type EntityOptionStatement, type EntityOptions, collectOptionStatements, resolveEntityOptions } from './resolve-entity-options.ts';

const {
  Validations: { PATTERN, REQUIRED, UNIQUE },
} = validations;
const { BUILT_IN_ENTITY } = relationshipOptions;
const GENERATOR_NAME = 'generator-jhipster';

/** The order the relationships are converted in: by type, then as written. */
const RELATIONSHIP_TYPES = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'];

/** The attributes of a json entity, in the order they are written; the ones without value are dropped when exported. */
const ENTITY_KEYS = [
  'annotations',
  'name',
  'fields',
  'relationships',
  'documentation',
  'entityTableName',
  'dto',
  'pagination',
  'service',
  'jpaMetamodelFiltering',
  'fluentMethods',
  'readOnly',
  'embedded',
  'clientRootFolder',
  'microserviceName',
  'angularJSSuffix',
  'skipServer',
  'skipClient',
  'applications',
] as const;

/** A json entity as the jdl converts it, before it is exported. */
export type JDLJSONEntity = Record<string, any> & {
  name: string;
  fields: JSONField[];
  relationships: Partial<JSONRelationship>[];
  applications: string[];
};

/** The application the jdl is imported into, when it declares none. */
export type ImportTarget = {
  applicationName?: string;
  applicationType?: ApplicationType;
};

export type JDLJSON = {
  /** The applications, as their `.yo-rc.json` content. */
  applications: PostProcessedJDLJSONApplication[];
  /** The json entities of each application, by application name. */
  entitiesPerApplication: Map<string, JDLJSONEntity[]>;
  /** The json entities, when the jdl declares no application. */
  entities?: JDLJSONEntity[];
  deployments: Partial<YoRcJHipsterDeploymentContent>[];
};

/** The options of an annotation list: the annotations repeated with different values give a list. */
function annotationsToOptions(annotations: ParsedJDLAnnotation[] = []): Record<string, any> {
  const result: Record<string, any> = {};
  for (const annotation of annotations) {
    const name = lowerFirst(annotation.optionName);
    const value = annotation.optionValue ?? true;
    if (!(name in result)) {
      result[name] = value;
    } else if (Array.isArray(result[name])) {
      if (!result[name].includes(value)) result[name].push(value);
    } else if (result[name] !== value) {
      result[name] = [result[name], value];
    }
  }
  return result;
}

/** A pattern validation has its single quotes escaped. */
function patternValue(value: string): string {
  // Escape every quote that is not escaped yet.
  return value.replaceAll(/(?<!\\)'/g, String.raw`\'`);
}

function convertValidations(fieldValidations: ParsedJDLValidation[], constants: Record<string, string>): Record<string, any> {
  // A validation written twice keeps the place of the first one and the value of the last one.
  const byName = new Map<string, any>();
  for (const { key, value, constant } of fieldValidations) {
    let resolved = constant ? constants[value as string] : value;
    if (key === PATTERN) {
      resolved = patternValue(resolved as string);
    }
    byName.set(key, resolved);
  }
  const result: Record<string, any> = {};
  for (const [name, value] of byName) {
    if (name !== REQUIRED && name !== UNIQUE) {
      result[`fieldValidateRules${capitalize(name)}`] = value;
    }
  }
  return { ...result, fieldValidateRules: [...byName.keys()] };
}

function convertEnumValues(jdlEnum: ParsedJDLEnum): { values: string; javadocs: Record<string, string> } {
  // A value written twice keeps the place of the first one.
  const byKey = new Map(jdlEnum.values.map(value => [value.key, value]));
  const javadocs: Record<string, string> = {};
  for (const { key, comment } of byKey.values()) {
    if (comment) javadocs[key] = comment;
  }
  return { values: [...byKey.values()].map(({ key, value }) => (value ? `${key} (${value})` : key)).join(','), javadocs };
}

function convertField(field: ParsedJDLEntityField, enums: Map<string, ParsedJDLEnum>, constants: Record<string, string>): JSONField {
  let json: JSONField = { fieldName: customCamelCase(lowerFirst(field.name)), fieldType: field.type };
  const documentation = formatComment(field.documentation);
  if (documentation) {
    json.documentation = documentation;
  }
  const jdlEnum = enums.get(field.type);
  if (jdlEnum) {
    const { values, javadocs } = convertEnumValues(jdlEnum);
    json.fieldValues = values;
    const enumDocumentation = formatComment(jdlEnum.documentation);
    if (enumDocumentation) {
      json.fieldTypeDocumentation = enumDocumentation;
    }
    if (Object.keys(javadocs).length > 0) {
      json.fieldValuesJavadocs = javadocs;
    }
  }
  if (field.validations.length > 0) {
    json = { ...json, ...convertValidations(field.validations, constants) };
  }
  const options = annotationsToOptions(field.annotations);
  if (Object.keys(options).length > 0) {
    json = { ...json, options };
  }
  return json;
}

function createEntity(entity: ParsedJDLEntity, enums: Map<string, ParsedJDLEnum>, constants: Record<string, string>): JDLJSONEntity {
  const json: Record<string, any> = Object.fromEntries(ENTITY_KEYS.map(key => [key, undefined]));
  // Fields written twice keep the place of the first one and the definition of the last one.
  const fields = new Map((entity.body ?? []).map(field => [lowerFirst(field.name), field]));
  Object.assign(json, {
    annotations: Object.fromEntries(
      (entity.annotations ?? []).map(annotation => [
        lowerFirst(annotation.optionName),
        annotation.type === 'UNARY' ? true : annotation.optionValue,
      ]),
    ),
    name: upperFirst(entity.name),
    fields: [...fields.values()].map(field => convertField(field, enums, constants)),
    relationships: [],
    documentation: formatComment(entity.documentation),
    entityTableName: entity.tableName,
    applications: [],
  });
  return json as JDLJSONEntity;
}

/** A relationship as the old model kept it: a relationship without injected field is bidirectional. */
type Relationship = {
  type: string;
  from: string;
  to: string;
  injectedFieldInFrom?: string | null;
  injectedFieldInTo?: string | null;
  requiredInFrom?: boolean;
  requiredInTo?: boolean;
  commentInFrom?: string;
  commentInTo?: string;
  global: Record<string, any>;
  source: Record<string, any>;
  destination: Record<string, any>;
};

function normalizeRelationships(relationships: ParsedJDLRelationship[]): Relationship[] {
  const byType = new Map<string, Map<string, Relationship>>(RELATIONSHIP_TYPES.map(type => [type, new Map()]));
  for (const { from, to, cardinality, options } of relationships) {
    const relationship: Relationship = {
      type: asJdlRelationshipType(cardinality),
      from: from.name,
      to: to.name,
      injectedFieldInFrom: from.injectedField,
      injectedFieldInTo: to.injectedField,
      requiredInFrom: from.required,
      requiredInTo: to.required,
      commentInFrom: formatComment(from.documentation),
      commentInTo: formatComment(to.documentation),
      global: annotationsToOptions(options.global),
      source: annotationsToOptions(options.source),
      destination: annotationsToOptions(options.destination),
    };
    if (!relationship.injectedFieldInFrom && !relationship.injectedFieldInTo) {
      relationship.injectedFieldInFrom = lowerFirst(relationship.to);
      relationship.injectedFieldInTo = lowerFirst(relationship.from);
    }
    const side = (name: string, injectedField?: string | null) => `${name}${injectedField ? `{${injectedField}}` : ''}`;
    const id = `${side(relationship.from, relationship.injectedFieldInFrom)}_${side(relationship.to, relationship.injectedFieldInTo)}`;
    if (!byType.has(relationship.type)) byType.set(relationship.type, new Map());
    byType.get(relationship.type)!.set(id, relationship);
  }
  return [...byType.values()].flatMap(ofType => [...ofType.values()]);
}

/** Splits `<relationshipName>(<otherEntityField>)`. */
function splitInjectedField(field?: string | null): { relationshipName: string; otherEntityField?: string } {
  if (!field) {
    return { relationshipName: '' };
  }
  const [relationshipName, otherEntityField] = field.replace('(', '/').replace(')', '').split('/');
  return otherEntityField === undefined ? { relationshipName } : { relationshipName, otherEntityField };
}

function withOptions(json: Partial<JSONRelationship>, ...sources: Record<string, any>[]): Partial<JSONRelationship> {
  const options: Record<string, any> = {};
  for (const source of sources) Object.assign(options, source);
  if (Object.keys(options).length > 0) {
    json.options = options;
  }
  return json;
}

function leftSide(relationship: Relationship): Partial<JSONRelationship> {
  const other = splitInjectedField(relationship.injectedFieldInTo);
  const json: Partial<JSONRelationship> = {
    relationshipSide: 'left',
    relationshipType: kebabCase(relationship.type) as RelationshipType,
    otherEntityName: customCamelCase(relationship.to),
  };
  if (other.relationshipName) {
    json.otherEntityRelationshipName = lowerFirst(other.relationshipName);
  }
  if (relationship.requiredInFrom) {
    json.relationshipValidateRules = REQUIRED;
  }
  if (relationship.commentInFrom) {
    json.documentation = relationship.commentInFrom;
  }
  const own = splitInjectedField(relationship.injectedFieldInFrom);
  json.relationshipName = customCamelCase(own.relationshipName || relationship.to);
  if (own.otherEntityField) {
    json.otherEntityField = lowerFirst(own.otherEntityField);
  }
  // The built-in entity option is not an option of the relationship: it comes after the options.
  const { [BUILT_IN_ENTITY]: builtInEntity, ...global } = relationship.global;
  withOptions(json, global, relationship.destination);
  if (BUILT_IN_ENTITY in relationship.global) {
    json.relationshipWithBuiltInEntity = builtInEntity;
  }
  return json;
}

function rightSide(relationship: Relationship): Partial<JSONRelationship> {
  const other = splitInjectedField(relationship.injectedFieldInFrom);
  const json: Partial<JSONRelationship> = {
    relationshipSide: 'right',
    relationshipType: kebabCase(relationship.type).split('-').reverse().join('-') as RelationshipType,
    otherEntityName: customCamelCase(relationship.from),
  };
  if (other.relationshipName) {
    json.otherEntityRelationshipName = lowerFirst(other.relationshipName) || customCamelCase(relationship.to);
  }
  if (relationship.requiredInTo) {
    json.relationshipValidateRules = REQUIRED;
  }
  if (relationship.commentInTo) {
    json.documentation = relationship.commentInTo;
  }
  const own = splitInjectedField(relationship.injectedFieldInTo);
  json.relationshipName = customCamelCase(own.relationshipName || relationship.from);
  if (own.otherEntityField) {
    json.otherEntityField = lowerFirst(own.otherEntityField);
  }
  return withOptions(json, relationship.global, relationship.source);
}

/**
 * The json relationships of each entity: first those it is the source of, then those it is the destination of, when
 * the destination side is navigable (it injects a field) or annotated.
 */
function convertRelationships(relationships: ParsedJDLRelationship[], entityNames: string[]): Map<string, Partial<JSONRelationship>[]> {
  const normalized = normalizeRelationships(relationships);
  return new Map(
    entityNames.map(entityName => [
      entityName,
      [
        ...normalized.filter(relationship => relationship.from === entityName).map(relationship => leftSide(relationship)),
        ...normalized
          .filter(
            relationship =>
              relationship.to === entityName && (relationship.injectedFieldInTo || Object.keys(relationship.source).length > 0),
          )
          .map(relationship => rightSide(relationship)),
      ],
    ]),
  );
}

/** The json entities of the jdl, by entity name, without their options. */
function convertEntities(ast: ParsedJDLApplications): Map<string, JDLJSONEntity> {
  const enums = new Map(ast.enums.map(jdlEnum => [jdlEnum.name, jdlEnum]));
  // An entity written twice keeps the place of the first one and the definition of the last one.
  const entities = new Map(ast.entities.map(entity => [entity.name, entity]));
  const converted = new Map([...entities.values()].map(entity => [entity.name, createEntity(entity, enums, ast.constants)]));
  const relationships = convertRelationships(ast.relationships, [...converted.keys()]);
  for (const [entityName, entityRelationships] of relationships) {
    converted.get(entityName)!.relationships.push(...entityRelationships);
  }
  return converted;
}

function applyOptions(entity: JDLJSONEntity, options: Record<string, string | boolean> | undefined) {
  Object.assign(entity, options);
}

/** The options the application a jdl without application is imported into gives every entity. */
function importTargetOptions(ast: ParsedJDLApplications, { applicationName, applicationType }: ImportTarget): EntityOptionStatement[] {
  if (applicationType !== APPLICATION_TYPE_MICROSERVICE) {
    return [];
  }
  const entityNames = ast.entities.map(entity => entity.name);
  const statement = (name: string) => ({
    name,
    value: applicationName!,
    entityNames: new Set(entityNames.length > 0 ? entityNames : ['*']),
    excludedNames: new Set<string>(),
  });
  return [
    ...(ast.options.microservice ? [] : [statement(binaryOptions.Options.MICROSERVICE)]),
    statement(binaryOptions.Options.CLIENT_ROOT_FOLDER),
  ];
}

/** A namespace config value has no declared type: a number is written as an integer, a list keeps each item once. */
function convertNamespaceValue(value: unknown): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return Array.isArray(value) ? [...new Set(value)] : value;
}

function convertApplicationConfig(application: ParsedJDLApplication, runtime: JDLRuntime): PostProcessedJDLJSONApplication {
  const { applicationDefinition } = runtime;
  const config: Record<string, any> = {};
  for (const [name, value] of Object.entries<unknown>({ baseName: 'jhipster', ...(application.config as Record<string, unknown>) })) {
    // The semantic rules checked the options.
    if (!applicationDefinition.doesOptionExist(name)) continue;
    const type = applicationDefinition.getTypeForOption(name);
    config[name] = type === 'list' || type === 'quotedList' ? [...new Set(value as string[])] : value;
  }
  const namespaceConfigs = Object.entries(application.namespaceConfigs ?? {});
  const converted: Record<string, any> = { [GENERATOR_NAME]: config };
  if (namespaceConfigs.length > 0) {
    converted.namespaceConfigs = Object.fromEntries(
      namespaceConfigs.map(([namespace, namespaceConfig]) => [
        namespace,
        Object.fromEntries(Object.entries(namespaceConfig).map(([name, value]) => [name, convertNamespaceValue(value)])),
      ]),
    );
  }
  config.entities = application.entities ?? [];
  if (config.creationTimestamp !== undefined) {
    config.creationTimestamp = Number.parseInt(config.creationTimestamp, 10);
  }
  const { blueprints, microfrontends } = config as { blueprints?: string[]; microfrontends?: string[] };
  const result = structuredClone(converted);
  result[GENERATOR_NAME] = {
    ...result[GENERATOR_NAME],
    blueprints: blueprints?.map(name => ({ name })),
    microfrontends: microfrontends?.map(baseName => ({ baseName })),
  };
  return result as PostProcessedJDLJSONApplication;
}

const DEPLOYMENT_KEYS = [
  'deploymentType',
  'appsFolders',
  'directoryPath',
  'gatewayType',
  'kubernetesServiceType',
  'istio',
  'ingressDomain',
  'ingressType',
  'storageType',
  'monitoring',
  'clusteredDbApps',
];

function convertDeployment(deployment: ParsedJDLDeployment): Partial<YoRcJHipsterDeploymentContent> {
  const merged: Record<string, any> = { ...getDefaultJDLDeploymentDefaults(deployment.deploymentType), ...deployment };
  const config: Record<string, any> = {};
  for (const key of [...DEPLOYMENT_KEYS, ...Object.keys(merged)]) {
    const value = merged[key];
    if (value === undefined || key in config) continue;
    config[key] = Array.isArray(value) && (key === 'appsFolders' || key === 'clusteredDbApps') ? [...new Set(value)] : value;
  }
  config.appsFolders = [...new Set<string>(merged.appsFolders ?? [])];
  config.clusteredDbApps = [...new Set<string>(merged.clusteredDbApps ?? [])];
  return { [GENERATOR_NAME]: structuredClone(config) };
}

/**
 * Converts the AST of a jdl, checked by the semantic rules, to the json of its applications, entities and deployments.
 * It reads no file: the entities are not merged yet with those of the applications on the disk.
 * @param ast - the AST of the jdl.
 * @param target - the application a jdl without application is imported into.
 */
export function astToJson(ast: ParsedJDLApplications, target: ImportTarget, runtime: JDLRuntime): JDLJSON {
  const entities = convertEntities(ast);
  const entityNames = [...entities.keys()];
  const globalOptions = resolveEntityOptions(
    collectOptionStatements(ast.options, ast.useOptions, importTargetOptions(ast, target)),
    entityNames,
  );
  const deployments = ast.deployments.map(deployment => convertDeployment(deployment));

  if (ast.applications.length === 0) {
    const withOptions = [...entities.values()].map(entity => {
      applyOptions(entity, globalOptions.get(entity.name));
      entity.applications.push('*');
      return entity;
    });
    return { applications: [], entitiesPerApplication: new Map(), entities: withOptions, deployments };
  }

  const applications = ast.applications.map(application => convertApplicationConfig(application, runtime));
  for (const entity of entities.values()) {
    applyOptions(entity, globalOptions.get(entity.name));
  }
  const entitiesPerApplication = new Map<string, JDLJSONEntity[]>();
  const withoutEntities: string[] = [];
  const applicationOptions: [ParsedJDLApplication, EntityOptions][] = [];
  for (const application of ast.applications) {
    const baseName = application.config.baseName ?? 'jhipster';
    const applicationEntityNames = application.entities ?? [];
    if (applicationEntityNames.length === 0) {
      withoutEntities.push(baseName);
      continue;
    }
    for (const entityName of applicationEntityNames) {
      entities.get(entityName)?.applications.push(baseName);
    }
    applicationOptions.push([
      application,
      resolveEntityOptions(collectOptionStatements(application.options ?? {}, application.useOptions ?? []), applicationEntityNames),
    ]);
  }
  for (const [application, options] of applicationOptions) {
    const baseName = application.config.baseName ?? 'jhipster';
    // An entity is kept once in an application, by its json name.
    const applicationEntities = new Map<string, JDLJSONEntity>();
    for (const entityName of application.entities!) {
      const entity = entities.get(entityName);
      if (entity) applicationEntities.set(entity.name, entity);
    }
    for (const [entityName, entityOptions] of options) {
      const entity = applicationEntities.get(entityName);
      if (entity) applyOptions(entity, entityOptions);
    }
    entitiesPerApplication.set(baseName, [...applicationEntities.values()]);
  }
  for (const baseName of withoutEntities) {
    entitiesPerApplication.set(baseName, []);
  }
  return { applications, entitiesPerApplication, deployments };
}
