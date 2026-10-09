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
import { kebabCase, upperFirst } from 'lodash-es';

import type { ExportEntityPropertiesFromConfigs, JHipsterEntityConfigs } from '../../lib/command/types.ts';
import type { MutateDataParam, MutateDataPropertiesWithRequiredProperties } from '../../lib/utils/object.ts';
import { normalizePathEnd } from '../../lib/utils/path.ts';
import { pluralize } from '../../lib/utils/string-utils.ts';
import { upperFirstCamelCase } from '../../lib/utils/string.ts';
import type { Relationship as BaseApplicationRelationship } from '../base-application/types.d.ts';
import type { Entity as CommonEntity, Field as CommonField, Relationship as CommonRelationship } from '../common/types.ts';
import type { Entity as LanguagesEntity, Field as LanguagesField, Relationship as LanguagesRelationship } from '../languages/types.d.ts';

import { getTypescriptType } from './support/types-utils.ts';

// DerivedBooleanPropertiesOf<'fieldTsType', FieldTsType> &
type ClientAddedFieldProperties = {
  tsType: string;
  htmlInputType: string;
  hidden?: boolean;
  hideListView?: boolean;
};

const htmlInputTypeForTsType: Record<string, string> = {
  number: 'number',
  boolean: 'checkbox',
  'dayjs.Dayjs': 'datetime-local',
};

export const mutateField = {
  __override__: false,
  tsType: ({ fieldType, fieldIsEnum }) => (fieldIsEnum ? fieldType : getTypescriptType(fieldType)),
  htmlInputType: ({ fieldIsEnum, fieldTypeLocalTime, tsType, fieldTypeBinary, blobContentTypeText }) => {
    if (fieldIsEnum) {
      return 'select';
    }
    if (fieldTypeLocalTime) {
      return 'time';
    }
    if (fieldTypeBinary && !blobContentTypeText) {
      return 'hidden';
    }
    return htmlInputTypeForTsType[tsType] ?? 'text';
  },

  // ...buildMutateDataForProperty('tsType', fieldTsTypes, { prefix: 'fieldTsType' }),
} as const satisfies MutateDataPropertiesWithRequiredProperties<MutateDataParam<Field>, ClientAddedFieldProperties>;

export type Field = CommonField & LanguagesField & ClientAddedFieldProperties;

export interface Relationship extends CommonRelationship, LanguagesRelationship {
  propertyTsType?: string;
}

/**
 * The properties of the entities the client generators compute, declared as the options of a command: any of them may be
 * set by the entity, in its file or with an annotation of the jdl (`@EntityTsName(...)`).
 */
export const entityProperties = {
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
} as const satisfies JHipsterEntityConfigs;

type ClientAddedEntityProperties = ExportEntityPropertiesFromConfigs<typeof entityProperties> & {
  tsPrimaryKeySamples?: string[];
};

export const mutateEntity = {
  __override__: false,
  entityAngularJSSuffix: data => {
    const entityAngularJSSuffix = data.entityAngularJSSuffix ?? data.angularJSSuffix ?? '';
    return entityAngularJSSuffix.startsWith('-') || !entityAngularJSSuffix ? entityAngularJSSuffix : `-${entityAngularJSSuffix}`;
  },
  entityTsName: data => upperFirst(data.entityNameCapitalized) + upperFirstCamelCase(data.entityAngularJSSuffix),
  entityFileName: data => kebabCase(data.entityNameCapitalized + upperFirst(data.entityAngularJSSuffix)),
  entityFolderName: data => `${normalizePathEnd(data.clientRootFolder)}${data.entityFileName}`,
  entityModelFileName: data => data.entityFolderName,
  entityPluralFileName: data => `${data.entityNamePluralizedAndSpinalCased}${data.entityAngularJSSuffix}`,
  entityServiceFileName: data => data.entityFileName,
  entityStateName: data => kebabCase(data.entityTsName),
  entityUrl: data => data.entityStateName,

  entityAngularName: data => data.entityTsName,
  entityAngularNamePlural: data => pluralize(data.entityAngularName, { force: true }),
  entityReactName: data => data.entityTsName,
} as const satisfies MutateDataPropertiesWithRequiredProperties<MutateDataParam<Entity>, ClientAddedEntityProperties>;

export interface Entity<F extends Field = Field, R extends BaseApplicationRelationship = BaseApplicationRelationship>
  extends CommonEntity<F, R>, LanguagesEntity<F, R>, ClientAddedEntityProperties {}
