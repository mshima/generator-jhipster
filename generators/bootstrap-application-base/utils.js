/**
 * Copyright 2013-2024 the original author or authors from the JHipster project.
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
import * as _ from 'lodash-es';
import { Validations, authenticationTypes, databaseTypes, fieldTypes } from '../../jdl/jhipster/index.js';
import { loadRequiredConfigIntoEntity } from '../base-application/support/index.js';
import { hibernateSnakeCase } from '../server/support/string.js';
import { PaginationTypes } from '../../jdl/jhipster/entity-options.js';
import { LOGIN_REGEX, LOGIN_REGEX_JS } from '../generator-constants.js';

const { CASSANDRA } = databaseTypes;
const { OAUTH2 } = authenticationTypes;
const { CommonDBTypes } = fieldTypes;

const { STRING: TYPE_STRING, BOOLEAN: TYPE_BOOLEAN } = CommonDBTypes;

const auditableEntityFields = () => [
  {
    fieldName: 'createdBy',
    fieldType: TYPE_STRING,
    skipServer: true,
    builtIn: true,
  },
  {
    fieldName: 'createdDate',
    fieldType: TYPE_STRING,
    skipServer: true,
    builtIn: true,
  },
  {
    fieldName: 'lastModifiedBy',
    fieldType: TYPE_STRING,
    skipServer: true,
    builtIn: true,
  },
  {
    fieldName: 'lastModifiedDate',
    fieldType: TYPE_STRING,
    skipServer: true,
    builtIn: true,
  },
];

const authorityEntityName = 'Authority';

// eslint-disable-next-line import/prefer-default-export
export function createUserEntity(customUserData = {}, application) {
  const userEntityDefinition = this.getEntityConfig('User')?.getAll();
  if (userEntityDefinition) {
    if (userEntityDefinition.relationships && userEntityDefinition.relationships.length > 0) {
      this.log.warn('Relationships on the User entity side will be disregarded');
    }
    if (userEntityDefinition.fields && userEntityDefinition.fields.some(field => field.fieldName !== 'id')) {
      this.log.warn('Fields on the User entity side (other than id) will be disregarded');
    }
  }

  const cassandraOrNoDatabase = application.databaseTypeNo || application.databaseTypeCassandra;
  // Create entity definition for built-in entity to make easier to deal with relationships.
  const user = {
    name: 'User',
    builtIn: true,
    entityTableName: `${application.jhiTablePrefix}_user`,
    relationships: [],
    fields: userEntityDefinition ? userEntityDefinition.fields || [] : [],
    dto: true,
    adminUserDto: `AdminUser${application.dtoSuffix ?? ''}`,
    builtInUser: true,
    skipClient: application.clientFrameworkReact || application.clientFrameworkVue,
    skipDbChangelog: true,
    entityDomainLayer: false,
    entityPersistenceLayer: false,
    entityRestLayer: false,
    entitySearchLayer: false,
    hasImageField: !cassandraOrNoDatabase,
    pagination: cassandraOrNoDatabase ? PaginationTypes.NO : PaginationTypes.PAGINATION,
    auditableEntity: !cassandraOrNoDatabase,
    ...customUserData,
  };

  loadRequiredConfigIntoEntity(user, application);
  // Fallback to defaults for test cases.
  loadRequiredConfigIntoEntity(user, this.jhipsterConfigWithDefaults);

  const oauth2 = user.authenticationType === OAUTH2;
  // If oauth2 or databaseType is cassandra, force type string, otherwise keep undefined for later processing.
  const userIdType = oauth2 || user.databaseType === CASSANDRA ? TYPE_STRING : undefined;
  const fieldValidateRulesMaxlength = userIdType === TYPE_STRING ? 100 : undefined;

  addOrExtendFields(user.fields, [
    {
      fieldName: 'id',
      fieldType: userIdType,
      fieldValidateRulesMaxlength,
      fieldTranslationKey: 'global.field.id',
      fieldNameHumanized: 'ID',
      id: true,
      builtIn: true,
    },
    {
      fieldName: 'login',
      fieldType: TYPE_STRING,
      fieldValidateRules: [Validations.REQUIRED, Validations.MAXLENGTH, Validations.PATTERN],
      fieldValidateRulesMaxlength: 50,
      fieldValidateRulesPattern: LOGIN_REGEX_JS,
      fieldValidateRulesPatternJava: LOGIN_REGEX,
      builtIn: true,
    },
    {
      fieldName: 'activated',
      fieldType: TYPE_BOOLEAN,
      builtIn: true,
    },
    {
      fieldName: 'firstName',
      fieldType: TYPE_STRING,
      fieldValidateRules: [Validations.MAXLENGTH],
      fieldValidateRulesMaxlength: 50,
      builtIn: true,
    },
    {
      fieldName: 'lastName',
      fieldType: TYPE_STRING,
      fieldValidateRules: [Validations.MAXLENGTH],
      fieldValidateRulesMaxlength: 50,
      builtIn: true,
    },
    {
      fieldName: 'email',
      fieldType: TYPE_STRING,
      fieldValidateRules: [Validations.REQUIRED, Validations.MAXLENGTH, Validations.MINLENGTH],
      fieldValidateRulesMinlength: 5,
      fieldValidateRulesMaxlength: 100,
      builtIn: true,
    },
    ...(user.hasImageField
      ? [
          {
            fieldName: 'imageUrl',
            fieldType: TYPE_STRING,
            fieldValidateRules: [Validations.MAXLENGTH],
            fieldValidateRulesMaxlength: 256,
            builtIn: true,
          },
        ]
      : []),
    ...(application.enableTranslation
      ? [
          {
            fieldName: 'langKey',
            fieldType: TYPE_STRING,
            builtIn: true,
          },
        ]
      : []),
    ...(user.auditableEntity ? auditableEntityFields() : []),
  ]);

  return user;
}

export function createAuthorityEntity(customAuthorityData = {}, application) {
  const entityDefinition = this.getEntityConfig(authorityEntityName)?.getAll();
  if (entityDefinition) {
    if (entityDefinition.relationships && entityDefinition.relationships.length > 0) {
      this.log.warn(`Relationships on the ${authorityEntityName} entity side will be disregarded`);
    }
    if (entityDefinition.fields && entityDefinition.fields.some(field => field.fieldName !== 'name')) {
      this.log.warn(`Fields on the ${authorityEntityName} entity side (other than name) will be disregarded`);
    }
  }

  // Create entity definition for built-in entity to make easier to deal with relationships.
  const authorityEntity = {
    name: authorityEntityName,
    entitySuffix: '',
    builtIn: true,
    adminEntity: true,
    entityTableName: `${application.jhiTablePrefix}_authority`,
    relationships: [],
    fields: entityDefinition ? entityDefinition.fields || [] : [],
    builtInAuthority: true,
    skipClient: !application.backendTypeSpringBoot || application.clientFrameworkReact || application.clientFrameworkVue,
    searchEngine: 'no',
    service: 'no',
    dto: 'no',
    entityR2dbcRepository: true,
    skipDbChangelog: true,
    entityDomainLayer: application.backendTypeSpringBoot,
    entityPersistenceLayer: application.backendTypeSpringBoot,
    entityRestLayer: application.backendTypeSpringBoot,
    ...customAuthorityData,
  };

  loadRequiredConfigIntoEntity(authorityEntity, application);
  // Fallback to defaults for test cases.
  loadRequiredConfigIntoEntity(authorityEntity, this.jhipsterConfigWithDefaults);

  addOrExtendFields(authorityEntity.fields, [
    {
      fieldName: 'name',
      fieldType: TYPE_STRING,
      id: true,
      fieldValidateRules: [Validations.MAXLENGTH, Validations.REQUIRED],
      fieldValidateRulesMaxlength: 50,
      builtIn: true,
    },
  ]);

  return authorityEntity;
}

function addOrExtendFields(fields, fieldsToAdd) {
  fieldsToAdd = [].concat(fieldsToAdd);
  for (const fieldToAdd of fieldsToAdd) {
    const { fieldName: newFieldName, id } = fieldToAdd;
    let field = fields.find(field => field.fieldName === newFieldName);
    if (!field) {
      field = { ...fieldToAdd };
      if (id) {
        fields.unshift(field);
      } else {
        fields.push(field);
      }
    } else {
      _.defaults(field, fieldToAdd);
    }
  }
}
