/**
 * Copyright 2013-2021 the original author or authors from the JHipster project.
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
const assert = require('assert');
const { existsSync, readFileSync } = require('fs');

const BaseEntitiesGenerator = require('./generator-base-entities.cjs');

/**
 * This is the base class for a generator that generates entities.
 */
class JHipsterBaseEntitiesIncrementalGenerator extends BaseEntitiesGenerator {
  constructor(args, options, features) {
    super(args, options, features);

    if (this.options.help) {
      return;
    }

    this.previousEntities = {};
  }

  /**
   * @inheritdoc
   */
  getEntitiesDataToLoad() {
    const entitiesData = super.getEntitiesDataToLoad();
    if (!this.jhipsterConfig.incrementalChangelog) return entitiesData;

    entitiesData.forEach(({ entityName, entityStorage }) => {
      const entity = ((this.options.applicationWithEntities || {}).previousEntities || []).find(entity => entity.name === entityName);
      if (entity) {
        this.previousEntities[entityName] = { fields: [], relationships: [], ...entity };
      } else if (existsSync(entityStorage.path)) {
        this.previousEntities[entityName] = JSON.parse(readFileSync(entityStorage.path));
      }
    });
    return entitiesData;
  }

  /**
   * @private
   */
  getPreviousEntitiesDataToPrepare() {
    if (!this.jhipsterConfig.incrementalChangelog) return [];
    return Object.entries(this.previousEntities).map(([entityName, previousEntity]) => ({
      entityName,
      description: `${entityName} (previous)`,
      previousEntity,
    }));
  }

  /**
   * @inheritdoc
   */
  getEntitiesDataToPrepare() {
    const entitiesData = super.getEntitiesDataToPrepare();
    if (!this.jhipsterConfig.incrementalChangelog) return entitiesData;
    return [...entitiesData, ...this.getPreviousEntitiesDataToPrepare()];
  }

  /**
   * @inheritdoc
   */
  getEntitiesFieldsDataToPrepare() {
    const data = super.getEntitiesFieldsDataToPrepare();
    if (!this.jhipsterConfig.incrementalChangelog) return data;
    return [
      ...data,
      ...this.getPreviousEntitiesDataToPrepare()
        .map(({ entityName, previousEntity, ...data }) =>
          previousEntity.fields.map(previousField => ({
            entityName,
            ...data,
            fieldName: previousField.fieldName,
            description: `${entityName}#${previousField.fieldName} (previous)`,
            previousEntity,
            previousField,
          }))
        )
        .flat(),
    ];
  }

  /**
   * @inheritdoc
   */
  getEntitiesRelationshipsDataToPrepare() {
    const data = super.getEntitiesRelationshipsDataToPrepare();
    if (!this.jhipsterConfig.incrementalChangelog) return data;
    return [
      ...data,
      ...this.getPreviousEntitiesDataToPrepare()
        .map(({ entityName, previousEntity, ...data }) =>
          previousEntity.relationships.map(previousRelationship => ({
            entityName,
            ...data,
            relationshipName: previousRelationship.relationshipName,
            description: `${entityName}#${previousRelationship.relationshipName} (previous)`,
            previousEntity,
            previousRelationship,
          }))
        )
        .flat(),
    ];
  }

  /**
   * @private
   * Get entities to write.
   * @returns {object[]}
   */
  getEntitiesDataToWrite() {
    const entitiesData = super.getEntitiesDataToWrite();
    if (!this.jhipsterConfig.incrementalChangelog) return entitiesData;
    const { entities } = entitiesData;
    return {
      ...entitiesData,
      previousEntities: Object.values(this.previousEntities),
      entitiesDiff: [...new Set([...entities.map(({ name }) => name), ...Object.keys(this.previousEntities)])]
        .map(entityName =>
          this.generateEntityDiff(
            entities.find(entity => entity.name === entityName),
            this.previousEntities[entityName]
          )
        )
        .filter(Boolean),
    };
  }

  /**
   * @typedef EntityChanges
   * @property {string} entityName
   * @property {boolean} incremental
   * @property {string} [changelogDate]
   * @property {string} [creationChangelogDate]
   * @property {object[]} addedFields
   * @property {object[]} removedFields
   * @property {object[]} addedRelationships
   * @property {object[]} removedRelationships
   */

  /**
   * @typedef ChangedEntity
   * @property {Entity} entity
   * @property {EntityChanges} entityChanges
   * @property {Entity} [previousEntity]
   */

  /**
   * @typedef EntityDiff
   * @property {Entity} entity
   * @property {EntityChanges} entityChanges
   * @property {Entity} [previousEntity]
   */

  /**
   * @private
   * Generate changelog from differences between the mem-fs entity and on disk entity.
   * @return {ChangedEntity[]}
   */
  generateEntityDiff(entity, previousEntity) {
    const { name, fields: newFields = [], relationships: newRelationships = [], incrementalChangelog: incremental, changelogDate } = entity;

    if (this.configOptions.recreateInitialChangelog || !this.jhipsterConfig.incrementalChangelog || !previousEntity) {
      return {
        entity,
        entityChanges: {
          entityName: name,
          incremental,
          changelogDate,
          addedFields: newFields,
          removedFields: [],
          addedRelationships: newRelationships,
          removedRelationships: [],
        },
      };
    }
    assert(name === previousEntity.name);
    this._debug(`Calculating diffs for ${name}`);

    const { fields: previousFields = [], relationships: previousRelationships = [] } = previousEntity;

    const previousFieldNames = previousFields.map(field => field.fieldName);
    const newFieldNames = newFields.map(field => field.fieldName);

    // Calculate new fields
    const addedFieldNames = newFieldNames.filter(fieldName => !previousFieldNames.includes(fieldName));
    const addedFields = addedFieldNames.map(fieldName => newFields.find(field => fieldName === field.fieldName));
    // Calculate removed fields
    const removedFieldNames = previousFieldNames.filter(fieldName => !newFieldNames.includes(fieldName));
    const removedFields = removedFieldNames.map(fieldName => previousFields.find(field => fieldName === field.fieldName));

    const newRelationshipNames = newRelationships.map(relationship => relationship.relationshipName);
    const previousRelationshipNames = previousRelationships.map(relationship => relationship.relationshipName);

    // Calculate new relationships
    const addedRelationshipNames = newRelationshipNames.filter(relationshipName => !previousRelationshipNames.includes(relationshipName));
    const addedRelationships = addedRelationshipNames.map(relationshipName =>
      newRelationships.find(relationship => relationshipName === relationship.relationshipName)
    );
    // Calculate removed relationships
    const removedRelationshipNames = previousRelationshipNames.filter(relationshipName => !newRelationshipNames.includes(relationshipName));
    const removedRelationships = removedRelationshipNames.map(relationshipName =>
      previousRelationships.find(relationship => relationshipName === relationship.relationshipName)
    );

    if (addedFields.length === 0 && removedFields.length === 0 && addedRelationships.length === 0 && removedRelationships.length === 0)
      return undefined;

    return {
      entity,
      previousEntity,
      entityChanges: {
        entityName: name,
        incremental: true,
        creationChangelogDate: changelogDate,
        addedFields,
        removedFields,
        addedRelationships,
        removedRelationships,
      },
    };
  }
}

module.exports = JHipsterBaseEntitiesIncrementalGenerator;
