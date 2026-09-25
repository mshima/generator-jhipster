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

import { binaryOptions, unaryOptions } from '../../core/built-in-options/index.ts';
import type { ParsedJDLOptionConfig, ParsedJDLUseOption } from '../../core/parsing/types/parsed.ts';
import logger from '../../core/utils/objects/logger.ts';

const { FILTER, NO_FLUENT_METHOD, READ_ONLY, EMBEDDED, SKIP_CLIENT, SKIP_SERVER } = unaryOptions;
const {
  Options: { ANGULAR_SUFFIX, DTO, MICROSERVICE, SEARCH },
} = binaryOptions;
const { SERVICE_CLASS } = binaryOptions.Values.service;

/** An option statement, once the statements with the same option, and value, are merged. */
export type EntityOptionStatement = {
  name: string;
  /** The value of a binary option. */
  value?: string;
  /** The entities the statement names; `*` for every entity. */
  entityNames: Set<string>;
  excludedNames: Set<string>;
};

/** The option statements of a jdl or of an application, as the AST keeps them. */
export type OptionsAST = Record<string, ParsedJDLOptionConfig | Record<string, ParsedJDLOptionConfig>>;

/** The option values of the json entities, by entity name. */
export type EntityOptions = Map<string, Record<string, string | boolean>>;

/**
 * Collects the option statements of a jdl or of an application in the order they apply: the statements passed
 * first, the unary options, the binary ones, then the `use` statements. The statements with the same option (and
 * value) are merged, keeping the place of the first one.
 */
export function collectOptionStatements(
  options: OptionsAST,
  useOptions: ParsedJDLUseOption[],
  first: EntityOptionStatement[] = [],
): EntityOptionStatement[] {
  // Keyed by option name, then by value: the statements of a binary option follow each other.
  const byName = new Map<string, Map<string | undefined, EntityOptionStatement>>();
  const add = (statement: EntityOptionStatement) => {
    const byValue = byName.get(statement.name) ?? new Map();
    byName.set(statement.name, byValue);
    const existing = byValue.get(statement.value);
    if (existing) {
      statement.entityNames.forEach(name => existing.entityNames.add(name));
      statement.excludedNames.forEach(name => existing.excludedNames.add(name));
    } else {
      byValue.set(statement.value, statement);
    }
  };
  const statement = (name: string, value: string | undefined, list: string[], excluded: string[]): EntityOptionStatement => ({
    name,
    value,
    // An option without entity applies to every entity.
    entityNames: new Set(list.length > 0 ? list : ['*']),
    excludedNames: new Set(excluded),
  });

  first.forEach(add);
  unaryOptions.forEach(name => {
    const option = options[name] as ParsedJDLOptionConfig | undefined;
    if (option?.list?.length) {
      add(statement(name, undefined, option.list, option.excluded));
    }
  });
  binaryOptions.forEach(name => {
    for (const [value, option] of Object.entries((options[name] ?? {}) as Record<string, ParsedJDLOptionConfig>)) {
      add(statement(name, value, option.list, option.excluded));
    }
  });
  for (const { optionValues, list, excluded } of useOptions) {
    for (const value of optionValues) {
      const name = binaryOptions.getOptionNameForValue(value);
      if (name) {
        add(statement(name, value, list, excluded));
      }
    }
  }
  return [...byName.values()].flatMap(byValue => [...byValue.values()]);
}

/** The key and the value an option statement sets in the json entities. */
function jsonOption({ name, value }: EntityOptionStatement): [string, string | boolean] {
  switch (name) {
    case SKIP_CLIENT:
    case SKIP_SERVER:
    case READ_ONLY:
    case EMBEDDED:
      return [name, true];
    case MICROSERVICE:
      return ['microserviceName', value!];
    case NO_FLUENT_METHOD:
      return ['fluentMethods', false];
    case ANGULAR_SUFFIX:
      return ['angularJSSuffix', value!];
    case SEARCH:
      return ['searchEngine', value!];
    case FILTER:
      return ['jpaMetamodelFiltering', true];
    default:
      return [name, value ?? true];
  }
}

/**
 * Resolves option statements into the option values of each entity: `*` names the entities passed, but those excluded,
 * and a later statement overrides an earlier one. An entity using a dto or filtering gets a service class, unless it
 * has another service; an entity excluded from a search statement is not searched.
 * @param statements - the option statements, in the order they apply.
 * @param entityNames - the entities `*` stands for.
 */
export function resolveEntityOptions(statements: EntityOptionStatement[], entityNames: string[]): EntityOptions {
  const resolved: EntityOptions = new Map();
  const set = (entityName: string, key: string, value: string | boolean) => {
    const options = resolved.get(entityName) ?? {};
    options[key] = value;
    resolved.set(entityName, options);
  };

  for (const statement of statements) {
    const names =
      statement.entityNames.has('*') ?
        entityNames.filter(entityName => !statement.excludedNames.has(entityName))
      : [...statement.entityNames];
    const [key, value] = jsonOption(statement);
    for (const entityName of names) {
      set(entityName, key, value);
    }
    if (statement.name === DTO || statement.name === FILTER) {
      for (const entityName of names) {
        const { service } = resolved.get(entityName)!;
        if (!service || service === 'no') {
          logger.info(
            `The ${statement.name} option is set for ${entityName}, the '${SERVICE_CLASS}' value for the ` +
              "'service' is gonna be set for this entity if no other value has been set.",
          );
          set(entityName, 'service', SERVICE_CLASS);
        }
      }
    }
    if (statement.name === SEARCH) {
      for (const entityName of statement.excludedNames) {
        set(entityName, 'searchEngine', 'no');
      }
    }
  }
  return resolved;
}
