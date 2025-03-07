/**
 * Copyright 2013-2025 the original author or authors from the JHipster project.
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

import { merge } from '../utils/object-utils.js';
import { addAll } from '../utils/set-utils.js';

export type JDLOptionParams = {
  name: string;
  entityNames?: Set<string> | string[];
  excludedNames?: Set<string> | string[];
};

export default class AbstractJDLOption {
  name: string;
  entityNames: Set<string>;
  excludedNames: Set<string>;

  constructor(args: JDLOptionParams) {
    const merged = merge(defaults(), args);
    if (!merged.name) {
      throw new Error("The option's name must be passed to create an option.");
    }
    this.name = merged.name;
    this.entityNames = new Set(merged.entityNames);
    if (this.entityNames.size === 0) {
      this.entityNames.add('*');
    }
    this.excludedNames = new Set(merged.excludedNames);
  }

  addEntityName(entityName: string) {
    if (!entityName) {
      throw new Error('An entity name has to be passed so as to be added to the option.');
    }
    if (this.excludedNames.has(entityName)) {
      return false;
    }
    if (this.entityNames.has('*')) {
      this.entityNames.delete('*');
    }
    return this.entityNames.add(entityName);
  }

  addEntitiesFromAnotherOption(option?: AbstractJDLOption): boolean {
    if (!option) {
      return false;
    }
    addAll(this.entityNames, Array.from(option.entityNames.values()));
    addAll(this.excludedNames, Array.from(option.excludedNames.values()));
    return true;
  }

  excludeEntityName(entityName: string): void {
    if (!entityName) {
      throw new Error('An entity name has to be passed so as to be excluded from the option.');
    }
    if (this.entityNames.has(entityName)) {
      return;
    }
    this.excludedNames.add(entityName);
  }

  getType(): string {
    throw new Error('Unsupported operation');
  }

  setEntityNames(newEntityNames: Iterable<string>): void {
    this.entityNames = new Set(newEntityNames);
  }

  /**
   * Resolves the option's list of entity names (without '*' and taking into account the excluded names).
   * @param entityNames all the entity names declared in a JDL Object.
   * @returns the resolved list.
   */
  resolveEntityNames(entityNames: string[] | undefined): Set<string> {
    if (!entityNames) {
      throw new Error("Entity names have to be passed to resolve the option's entities.");
    }
    const resolvedEntityNames = this.entityNames.has('*') ? new Set(entityNames) : this.entityNames;

    this.excludedNames.forEach(excludedEntityName => {
      resolvedEntityNames.delete(excludedEntityName);
    });

    return resolvedEntityNames;
  }
}

function defaults(): Partial<AbstractJDLOption> {
  return {
    entityNames: new Set(['*']),
    excludedNames: new Set(),
  };
}
