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
import type { JHipsterTemplateProperties } from '../../lib/command/types.ts';

/**
 * The properties the templates of the generator use, computed by it unless set otherwise: by the entity, in its file
 * or with an annotation of the jdl. Declared as the options of a command.
 */
const templateProperties = {
  /** The properties of the entities. */
  entity: {
    entityFileName: { description: 'Name of the files of the entity', type: String },
    entityFolderName: { description: 'Folder of the files of the entity', type: String },
    entityModelFileName: { description: 'Name of the model file of the entity', type: String },
    entityPluralFileName: { description: 'Name of the files of the entity in plural', type: String },
    entityServiceFileName: { description: 'Name of the service file of the entity', type: String },

    entityClientModelOnly: { description: 'Generate only the model at client side for relationships', type: Boolean, optional: true },
    entityTsName: { description: 'Name of the entity in TypeScript', type: String },
    entityAngularName: { description: 'Name of the entity in Angular', type: String },
    entityAngularNamePlural: { description: 'Name of the entity in Angular in plural', type: String },
    entityReactName: { description: 'Name of the entity in React', type: String },
    entityStateName: { description: 'Name of the state of the entity', type: String },
    entityUrl: { description: 'Url of the pages of the entity', type: String },
    entityPage: { description: 'Page of the entity, in the microfrontend of its microservice', type: String, optional: true },

    tsKeyType: { description: 'TypeScript type of the primary key', type: String, optional: true },
    tsSampleWithPartialData: { description: 'Sample of the entity with some fields', type: String, optional: true },
    tsSampleWithRequiredData: { description: 'Sample of the entity with the required fields', type: String, optional: true },
    tsSampleWithFullData: { description: 'Sample of the entity with every field', type: String, optional: true },
    tsSampleWithNewData: { description: 'Sample of a new entity', type: String, optional: true },

    entityAngularJSSuffix: { description: 'Suffix of the names of the entity at client side, starting with a dash', type: String },
  },
} as const satisfies JHipsterTemplateProperties;

export default templateProperties;
