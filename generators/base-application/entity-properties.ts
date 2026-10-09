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
import type { JHipsterEntityConfigs } from '../../lib/command/types.ts';

/**
 * The properties of the entities the base application generator computes, declared as the options of a command: any of
 * them may be set by the entity, in its file or with an annotation of the jdl.
 */
const entityProperties = {
  entityAuthority: { description: 'Authority required to change the entity', type: String, optional: true },
  entityReadAuthority: { description: 'Authority required to read the entity', type: String, optional: true },

  entityNameCapitalized: { description: 'Name of the entity, capitalized', type: String },
  entityNameKebabCase: { description: 'Name of the entity, in kebab case', type: String },
  entityNamePlural: { description: 'Name of the entity in plural', type: String },
  entityNamePluralizedAndSpinalCased: { description: 'Name of the entity in plural, in kebab case', type: String },
  entityInstancePlural: { description: 'Name of an instance of the entity in plural', type: String },
  entityInstance: { description: 'Name of an instance of the entity', type: String },

  entityNameHumanized: { description: 'Name of the entity, humanized', type: String },
  entityNamePluralHumanized: { description: 'Name of the entity in plural, humanized', type: String },
} as const satisfies JHipsterEntityConfigs;

export default entityProperties;
