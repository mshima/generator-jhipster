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
import type { JDLDefinitions } from 'jdl-parser';
import { jhipsterSemanticRules } from 'jdl-parser/jhipster';

import type { JHipsterConfigs } from '../command/types.ts';
import { getDefaultJDLEntityConfig } from '../jdl-config/jdl-entity-config.ts';
import { getDefaultJDLFieldTypesConfig } from '../jdl-config/jdl-field-types-config.ts';
import { getDefaultJDLValidationConfig } from '../jdl-config/jdl-validation-config.ts';
import { resolveGeneratorDependencies } from '../resolver/generator-dependencies.ts';
import { getJHipsterStore } from '../resolver/lookups.ts';

type JDLConfigDefinition = JDLDefinitions['application'];
type JDLConfigOption = JDLConfigDefinition['configs'][string];
type JDLConfigOptionType = JDLConfigOption['jdl']['type'];
type JDLOptionConfig = JDLDefinitions['entity']['configs'][string];

/** The JHipster definitions of the jdl, the semantic rules included, without the relationship ones. */
export type JHipsterJDLDefinitions = Required<Omit<JDLDefinitions, 'relationship' | 'builtInEntities'>>;

/** The type of the value of an option, by the token its command config writes it with. */
const TOKEN_TYPES: Readonly<Record<string, JDLConfigOptionType>> = {
  BOOLEAN: 'boolean',
  INTEGER: 'integer',
  NAME: 'name',
  qualifiedName: 'qualifiedName',
  STRING: 'string',
  list: 'list',
  quotedList: 'quotedList',
};

/** How a json entity holds the entity options it does not hold by their name. */
const ENTITY_JSON_OPTIONS: Readonly<Record<string, NonNullable<JDLOptionConfig['json']>>> = {
  noFluentMethod: { key: 'fluentMethods', value: false },
  filter: { key: 'jpaMetamodelFiltering' },
  microservice: { key: 'microserviceName' },
  search: { key: 'searchEngine' },
  angularSuffix: { key: 'angularJSSuffix' },
};

/** The validations of the language, written without a value. */
const LANGUAGE_VALIDATIONS: JDLDefinitions['validation']['configs'] = {
  required: { description: 'The field is required', jdl: {} },
  unique: { description: 'The field is unique', jdl: {} },
};

/** The configs of a generator and of everything it imports, the dependency graph the cli resolves. */
const lookupConfigsFrom = (generator: string): JHipsterConfigs => {
  const store = getJHipsterStore();
  const configs: JHipsterConfigs = {};
  for (const { command } of resolveGeneratorDependencies([generator], { getGeneratorMeta: namespace => store.getMeta(namespace) })) {
    Object.assign(configs, command?.configs);
  }
  return configs;
};

/**
 * The jdl options of command configs, one config each: the type of its value, a quoted one a string, its pattern, its
 * choices and why it is deprecated. An option comes before the options its name starts with, which the lexer needs.
 */
export const buildJDLConfigDefinition = (configs: JHipsterConfigs): JDLConfigDefinition => ({
  configs: Object.fromEntries(
    Object.entries(configs)
      .filter(([_name, config]) => config.jdl)
      .sort(([a], [b]) => (b.startsWith(a) ? 1 : a.localeCompare(b)))
      .map(([name, { description, choices, jdl }]): [string, JDLConfigOption] => {
        const { tokenType, tokenValuePattern, quoted, deprecated } = jdl!;
        const type = quoted ? 'string' : TOKEN_TYPES[tokenType];
        if (!type) {
          throw new Error(`The option ${name} has the token type ${tokenType}, which no jdl value has.`);
        }
        return [
          name,
          {
            ...(typeof description === 'string' ? { description } : {}),
            ...(choices ? { choices: choices.map(choice => (typeof choice === 'string' ? choice : choice.value)) } : {}),
            ...(deprecated ? { deprecated } : {}),
            jdl: { type, ...(tokenValuePattern ? { pattern: tokenValuePattern } : {}) },
          },
        ];
      }),
  ),
});

let defaultDefinitions: Readonly<JHipsterJDLDefinitions> | undefined;

/**
 * The JHipster definitions of the jdl in the format of jdl-parser, for its `createRuntime`: the application and deployment
 * options of the generators, the entity option statements with how a json entity holds them, the field validations and
 * types, and the semantic rules of JHipster for its AST.
 */
export const getDefaultJDLDefinitions = (): Readonly<JHipsterJDLDefinitions> => {
  const fieldTypes = getDefaultJDLFieldTypesConfig();
  defaultDefinitions ??= Object.freeze({
    application: buildJDLConfigDefinition(lookupConfigsFrom('app')),
    deployment: buildJDLConfigDefinition(lookupConfigsFrom('deployment')),
    entity: {
      configs: Object.fromEntries(
        Object.entries(getDefaultJDLEntityConfig().configs).map(([name, config]) => [
          name,
          ENTITY_JSON_OPTIONS[name] ? { ...config, json: ENTITY_JSON_OPTIONS[name] } : config,
        ]),
      ),
    },
    validation: { configs: { ...LANGUAGE_VALIDATIONS, ...getDefaultJDLValidationConfig().configs } },
    fieldTypes: { configs: fieldTypes.types, enum: fieldTypes.enum },
    rules: jhipsterSemanticRules,
  });
  return defaultDefinitions;
};
