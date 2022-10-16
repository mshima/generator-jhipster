/**
 * Copyright 2013-2022 the original author or authors from the JHipster project.
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
import assert from 'assert';
import _ from 'lodash';

import BaseApplication from '../base-application/index.mjs';
import { addEntityFiles, updateEntityFiles, updateConstraintsFiles, updateMigrateFiles, fakeFiles } from './files.mjs';
import { stringify } from '../../utils/index.mjs';
import { fieldTypes } from '../../jdl/jhipster/index.mjs';
import { GENERATOR_LIQUIBASE_CHANGELOGS, GENERATOR_BOOTSTRAP_APPLICATION } from '../generator-list.mjs';
import { prepareFieldForTemplates } from '../../utils/field.mjs';
import { prepareRelationshipForTemplates } from '../../utils/relationship.mjs';
import { prepareFieldForLiquibaseTemplates } from '../../utils/liquibase.mjs';

const { CommonDBTypes } = fieldTypes;
const TYPE_LONG = CommonDBTypes.LONG;

export default class DatabaseChangelogLiquibase extends BaseApplication {
  constructor(args, options, features) {
    super(args, options, { unique: undefined, ...features });

    if (this.options.help) return;

    assert(this.options.databaseChangelog, 'Changelog is required');
    this.databaseChangelog = this.options.databaseChangelog;
    if (!this.databaseChangelog.changelogDate) {
      this.databaseChangelog.changelogDate = this.dateFormatForLiquibase();
    }

    // Set number of rows to be generated
    this.numberOfRows = 10;
    this.entityChanges = {};
  }

  async _postConstruct() {
    // TODO V8 switch to GENERATOR_BOOTSTRAP_APPLICATION_SERVER
    await this.dependsOnJHipster(GENERATOR_BOOTSTRAP_APPLICATION);
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints(GENERATOR_LIQUIBASE_CHANGELOGS);
    }
  }

  get preparing() {
    return this.asPreparingTaskGroup({
      prepareEntityForTemplates({ application }) {
        const databaseChangelog = this.databaseChangelog;
        const entity = this.sharedData.getEntity(databaseChangelog.entityName);
        if (!entity) {
          throw new Error(`Shared entity ${databaseChangelog.entityName} was not found`);
        }
        this.entity = entity;
        const entityChanges = this.entityChanges;
        entityChanges.skipFakeData = application.skipFakeData || entity.skipFakeData;

        entityChanges.allFields = entity.fields
          .filter(field => !field.transient)
          .map(field => prepareFieldForLiquibaseTemplates(entity, field));

        if (databaseChangelog.type === 'entity-new') {
          entityChanges.fields = entityChanges.allFields;
        } else {
          entityChanges.addedFields = databaseChangelog.addedFields
            .map(field => prepareFieldForTemplates(entity, field, this))
            .filter(field => !field.transient)
            .map(field => prepareFieldForLiquibaseTemplates(entity, field));
          entityChanges.removedFields = databaseChangelog.removedFields
            .map(field => prepareFieldForTemplates(entity, field, this))
            .filter(field => !field.transient)
            .map(field => prepareFieldForLiquibaseTemplates(entity, field));
        }
      },

      prepareFakeData() {
        const { entity, databaseChangelog, entityChanges } = this;
        const seed = `${entity.entityClass}-liquibase`;
        this.resetEntitiesFakeData(seed);

        // fakeDataCount must be limited to the size of required unique relationships.
        Object.defineProperty(entity, 'fakeDataCount', {
          get: () => {
            const uniqueRelationships = entity.relationships.filter(rel => rel.unique && (rel.relationshipRequired || rel.id));
            return _.min([entity.liquibaseFakeData.length, ...uniqueRelationships.map(rel => rel.otherEntity.fakeDataCount)]);
          },
          configurable: true,
        });

        entity.liquibaseFakeData = Array.from({ length: this.numberOfRows }, () => ({}));
        if (!entity.liquibaseHeader) {
          entity.liquibaseHeader = [];
        }

        this.fieldsWithFakeData =
          databaseChangelog.type === 'entity-new'
            ? // generate id fields first to improve reproducibility
              [...entityChanges.fields.filter(f => f.id), ...entityChanges.fields.filter(f => !f.id)]
            : [...entityChanges.allFields.filter(f => f.id), ...entityChanges.addedFields.filter(f => !f.id)];

        for (const field of this.fieldsWithFakeData) {
          entity.liquibaseHeader.push(field.columnName);
          if (field.shouldCreateContentType) {
            entity.liquibaseHeader.push(`${field.columnName}_content_type`);
          }
        }

        for (let rowNumber = 0; rowNumber < entity.liquibaseFakeData.length; rowNumber++) {
          const rowData = entity.liquibaseFakeData[rowNumber];
          for (const field of this.fieldsWithFakeData) {
            if (field.derived) {
              Object.defineProperty(rowData, field.fieldName, {
                get: () => {
                  if (!field.derivedEntity.liquibaseFakeData || rowNumber >= field.derivedEntity.liquibaseFakeData.length) {
                    return undefined;
                  }
                  return field.derivedEntity.liquibaseFakeData[rowNumber][field.fieldName];
                },
              });
            } else {
              rowData[field.fieldName] = field.id && field.fieldType === TYPE_LONG ? rowNumber + 1 : field.generateFakeData();
              if (field.shouldCreateContentType) {
                rowData[`${field.fieldName}ContentType`] = 'image/png';
              }
            }
          }
        }
      },
    });
  }

  get [BaseApplication.PREPARING]() {
    return this.delegateTasksToBlueprint(() => this.preparing);
  }

  get default() {
    return {
      checkFakeData() {
        const { entity } = this;

        const requiredFieldsWithFakeData = this.fieldsWithFakeData.filter(
          field => field.id || (field.fieldValidateRules && field.fieldValidateRules.includes('required'))
        );
        entity.liquibaseFakeData = entity.liquibaseFakeData.filter(
          rowData => !requiredFieldsWithFakeData.find(field => rowData[field.fieldName] === undefined)
        );
      },
      prepareRelationshipsForTemplates() {
        const entityChanges = this.entityChanges;
        const databaseChangelog = this.databaseChangelog;
        const entity = this.entity;
        if (databaseChangelog.type === 'entity-new') {
          entityChanges.relationships = entity.relationships.map(relationship =>
            this._prepareRelationshipForTemplates(entity, relationship)
          );
        } else {
          entityChanges.addedRelationships = databaseChangelog.addedRelationships
            .map(relationship => {
              const otherEntityName = this._.upperFirst(relationship.otherEntityName);
              relationship.otherEntity = this.sharedData.getEntity(otherEntityName);
              if (!relationship.otherEntity) {
                throw new Error(`Error at entity ${entity.name}: could not find the entity of the relationship ${stringify(relationship)}`);
              }
              return relationship;
            })
            .map(relationship => prepareRelationshipForTemplates(entity, relationship, this))
            .map(relationship => this._prepareRelationshipForTemplates(entity, relationship));
          entityChanges.removedRelationships = databaseChangelog.removedRelationships
            .map(relationship => {
              const otherEntityName = this._.upperFirst(relationship.otherEntityName);
              relationship.otherEntity = this.configOptions.oldSharedEntities[otherEntityName];
              if (!relationship.otherEntity) {
                throw new Error(`Error at entity ${entity.name}: could not find the entity of the relationship ${stringify(relationship)}`);
              }
              return relationship;
            })
            .map(relationship => prepareRelationshipForTemplates(entity, relationship, this, true))
            .map(relationship => this._prepareRelationshipForTemplates(entity, relationship));
        }
      },

      prepareRelationshipsFakeData() {
        const { entity, databaseChangelog, entityChanges } = this;
        const seed = `${entity.entityClass}-liquibase-relationships`;
        this.resetEntitiesFakeData(seed);

        const relationshipsToPrepare =
          databaseChangelog.type === 'entity-new' ? entityChanges.relationships : entityChanges.addedRelationships;
        this.relationshipsWithFakeData = relationshipsToPrepare.filter(
          relationship =>
            relationship.relationshipRequired &&
            relationship.relationshipValidate === true &&
            (relationship.relationshipType === 'many-to-one' ||
              (relationship.relationshipType === 'one-to-one' && relationship.ownerSide === true && !relationship.id))
        );

        const fakeDataCount = _.min(
          this.relationshipsWithFakeData
            .filter(relationship => relationship.unique)
            .map(relationship => relationship.otherEntity.fakeDataCount)
            .concat(entity.liquibaseFakeData.length)
        );

        entity.liquibaseFakeData = entity.liquibaseFakeData.slice(0, fakeDataCount);

        for (const { joinColumnNames } of this.relationshipsWithFakeData) {
          entity.liquibaseHeader.push(joinColumnNames[0]);
        }

        for (let rowNumber = 0; rowNumber < entity.liquibaseFakeData.length; rowNumber++) {
          const rowData = entity.liquibaseFakeData[rowNumber];
          for (const relationship of this.relationshipsWithFakeData) {
            let relationshipRow = rowData;
            if (relationshipRow >= relationship.otherEntity.fakeDataCount) {
              relationshipRow = entity.faker.datatype.number({ min: 1, max: relationship.otherEntity.fakeDataCount }) - 1;
            }
            rowData[relationship.relationshipName] =
              relationship.relationship.otherEntity.liquibaseFakeData[relationshipRow][relationship.otherEntity.primaryKey.name];
          }
        }
      },
    };
  }

  get [BaseApplication.DEFAULT]() {
    return this.delegateTasksToBlueprint(() => this.default);
  }

  // Public API method used by the getter and also by Blueprints
  get writingEntities() {
    return {
      writeLiquibaseFiles({ application }) {
        const entity = this.entity;
        if (entity.skipServer) {
          return {};
        }
        const entityChanges = this.entityChanges;
        const databaseChangelog = this.databaseChangelog;

        /* Required by the templates */
        const writeContext = {
          entity,
          databaseChangelog,
          changelogDate: databaseChangelog.changelogDate,
          databaseType: entity.databaseType,
          prodDatabaseType: entity.prodDatabaseType,
          authenticationType: entity.authenticationType,
          jhiPrefix: entity.jhiPrefix,
          reactive: application.reactive,
          incrementalChangelog: application.incrementalChangelog,
          recreateInitialChangelog: this.configOptions.recreateInitialChangelog,
          fieldsWithFakeData: this.fieldsWithFakeData,
          relationshipsWithFakeData: this.relationshipsWithFakeData,
        };

        if (databaseChangelog.type === 'entity-new') {
          return this._writeLiquibaseFiles(writeContext, entityChanges);
        }

        entityChanges.requiresUpdateChangelogs =
          entityChanges.addedFields.length > 0 ||
          entityChanges.removedFields.length > 0 ||
          entityChanges.addedRelationships.some(
            relationship => relationship.shouldWriteRelationship || relationship.shouldWriteJoinTable
          ) ||
          entityChanges.removedRelationships.some(
            relationship => relationship.shouldWriteRelationship || relationship.shouldWriteJoinTable
          );

        if (entityChanges.requiresUpdateChangelogs) {
          entityChanges.hasFieldConstraint = entityChanges.addedFields.some(field => field.unique || !field.nullable);
          entityChanges.hasRelationshipConstraint = entityChanges.addedRelationships.some(
            relationship =>
              (relationship.shouldWriteRelationship || relationship.shouldWriteJoinTable) && (relationship.unique || !relationship.nullable)
          );
          entityChanges.shouldWriteAnyRelationship = entityChanges.addedRelationships.some(
            relationship => relationship.shouldWriteRelationship || relationship.shouldWriteJoinTable
          );

          return this._writeUpdateFiles(writeContext, entityChanges);
        }
        return undefined;
      },
    };
  }

  get [BaseApplication.WRITING_ENTITIES]() {
    if (this.options.skipWriting) {
      return {};
    }
    return this.delegateTasksToBlueprint(() => this.writingEntities);
  }

  // Public API method used by the getter and also by Blueprints
  get postWritingEntities() {
    return {
      writeLiquibaseFiles({ application }) {
        const entity = this.entity;
        if (entity.skipServer) {
          return {};
        }
        const databaseChangelog = this.databaseChangelog;
        const entityChanges = this.entityChanges;

        if (databaseChangelog.type === 'entity-new') {
          return this._addLiquibaseFilesReferences(entity, databaseChangelog);
        }
        if (entityChanges.requiresUpdateChangelogs) {
          return this._addUpdateFilesReferences(entity, databaseChangelog, entityChanges);
        }
        return undefined;
      },
    };
  }

  get [BaseApplication.POST_WRITING_ENTITIES]() {
    if (this.options.skipWriting) {
      return {};
    }
    return this.delegateTasksToBlueprint(() => this.postWritingEntities);
  }

  /**
   * Write files for new entities.
   */
  _writeLiquibaseFiles(writeContext, entityChanges) {
    const promises = [];
    const context = {
      ...writeContext,
      skipFakeData: entityChanges.skipFakeData,
      fields: entityChanges.allFields,
      allFields: entityChanges.allFields,
      relationships: entityChanges.relationships,
    };
    // Write initial liquibase files
    promises.push(this.writeFiles({ sections: addEntityFiles, context }));
    if (!entityChanges.skipFakeData) {
      promises.push(this.writeFiles({ sections: fakeFiles, context }));
    }

    return Promise.all(promises);
  }

  /**
   * Write files for new entities.
   */
  _addLiquibaseFilesReferences(entity, databaseChangelog) {
    const fileName = `${databaseChangelog.changelogDate}_added_entity_${entity.entityClass}`;
    if (entity.incremental) {
      this.addIncrementalChangelogToLiquibase(fileName);
    } else {
      this.addChangelogToLiquibase(fileName);
    }

    if (entity.fieldsContainOwnerManyToMany || entity.fieldsContainOwnerOneToOne || entity.fieldsContainManyToOne) {
      const constFileName = `${databaseChangelog.changelogDate}_added_entity_constraints_${entity.entityClass}`;
      if (entity.incremental) {
        this.addIncrementalChangelogToLiquibase(constFileName);
      } else {
        this.addConstraintsChangelogToLiquibase(constFileName);
      }
    }
  }

  /**
   * Write files for updated entities.
   */
  _writeUpdateFiles(writeContext, entityChanges) {
    const {
      addedFields,
      allFields,
      removedFields,
      addedRelationships,
      removedRelationships,
      hasFieldConstraint,
      hasRelationshipConstraint,
      shouldWriteAnyRelationship,
    } = entityChanges;

    const context = {
      ...writeContext,
      skipFakeData: entityChanges.skipFakeData,
      addedFields,
      removedFields,
      fields: addedFields,
      allFields,
      hasFieldConstraint,
      addedRelationships,
      removedRelationships,
      relationships: addedRelationships,
      hasRelationshipConstraint,
      shouldWriteAnyRelationship,
    };

    const promises = [];
    promises.push(this.writeFiles({ sections: updateEntityFiles, context }));

    if (!entityChanges.skipFakeData && (entityChanges.addedFields.length > 0 || shouldWriteAnyRelationship)) {
      promises.push(this.writeFiles({ sections: fakeFiles, context }));
      promises.push(this.writeFiles({ sections: updateMigrateFiles, context }));
    }

    if (hasFieldConstraint || shouldWriteAnyRelationship) {
      promises.push(this.writeFiles({ sections: updateConstraintsFiles, context }));
    }
    return Promise.all(promises);
  }

  /**
   * Write files for updated entities.
   */
  _addUpdateFilesReferences(entity, databaseChangelog, entityChanges) {
    this.addIncrementalChangelogToLiquibase(`${databaseChangelog.changelogDate}_updated_entity_${entity.entityClass}`);

    if (!entityChanges.skipFakeData && (entityChanges.addedFields.length > 0 || entityChanges.shouldWriteAnyRelationship)) {
      this.addIncrementalChangelogToLiquibase(`${databaseChangelog.changelogDate}_updated_entity_migrate_${entity.entityClass}`);
    }

    if (entityChanges.hasFieldConstraint || entityChanges.shouldWriteAnyRelationship) {
      this.addIncrementalChangelogToLiquibase(`${databaseChangelog.changelogDate}_updated_entity_constraints_${entity.entityClass}`);
    }
  }

  _prepareRelationshipForTemplates(entity, relationship) {
    relationship.shouldWriteRelationship =
      relationship.relationshipType === 'many-to-one' ||
      (relationship.relationshipType === 'one-to-one' && relationship.ownerSide === true);

    if (relationship.shouldWriteJoinTable) {
      const joinTableName = relationship.joinTable.name;
      const prodDatabaseType = entity.prodDatabaseType;
      _.defaults(relationship.joinTable, {
        constraintName: this.getFKConstraintName(joinTableName, entity.entityTableName, prodDatabaseType),
        otherConstraintName: this.getFKConstraintName(joinTableName, relationship.columnName, prodDatabaseType),
      });
    }

    relationship.columnDataType = relationship.otherEntity.columnType;
    return relationship;
  }
}
