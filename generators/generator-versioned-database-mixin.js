/**
 * Copyright 2013-2020 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const _ = require('lodash');
const jhiCore = require('jhipster-core');
const chalk = require('chalk');

module.exports = {
    /**
     * Load entity and apply every changelog
     * @param {String} entityName - Entity to load
     * @param {String} [untilChangelog] - Apply changelogs less than or equals
     * @returns {Object} Entity definition.
     */
    loadDatabaseChangelogEntity(entityName, untilChangelog, returnRemoved) {
        const toApply = this.loadDatabaseChangelogs(
            changelog => changelog.entityName === entityName && (!untilChangelog || changelog.changelogDate <= untilChangelog)
        );
        const entity = this.applyDatabaseChangelogs(toApply, entityName, returnRemoved);
        entity.name = entity.name || entityName;
        return entity;
    },

    /**
     * Load ordered changelogs
     * @param {any} [filter] - lodash filter
     * @returns {Array} Array of changelogs
     */
    loadDatabaseChangelogs(filter) {
        const databaseChangelogs = this.config.get('databaseChangelogs');
        if (!databaseChangelogs) {
            throw new Error('Cannot find any changelog');
        }
        let changelogs = Object.values(databaseChangelogs);
        if (filter) {
            changelogs = _.filter(changelogs, filter);
        }

        function isBefore(e1, e2) {
            let diff = e1.changelogDate - e2.changelogDate;
            if (diff === 0 && e1.entityName && e2.entityName) {
                diff = e1.entityName > e2.entityName;
            }
            return diff;
        }

        // Sort by changelogDate
        changelogs.sort(isBefore);
        return changelogs;
    },

    /**
     * Apply changelogs
     * @param {Array} changelogsToApply - Changelogs to apply.
     * @param {String} entityName - Entity name to filter.
     * @param {Boolean} returnRemoved - Add removedFields and removedRelationships to the returned object
     * @returns {any} The Entity definition.
     */
    applyDatabaseChangelogs(changelogsToApply, entityName, returnRemoved) {
        if (!changelogsToApply) {
            return undefined;
        }
        const context = { fields: [], relationships: [] };
        let initialized = false;
        changelogsToApply.forEach(changelog => {
            if (changelog.entityName !== entityName) {
                return;
            }
            if (changelog.type === 'entity-new' || changelog.type === 'entity-snapshot') {
                Object.assign(context, changelog.definition);
                initialized = true;
            }
            if (!initialized) {
                throw new Error(
                    `Error applying changelogs, entity ${entityName} was not initialized at changelog ${changelog.changelogDate}`
                );
            }
            const removedFields = [];
            if (changelog.removedFields) {
                context.fields = context.fields.filter(field => {
                    const isRemoved = changelog.removedFields.includes(field.fieldName);
                    if (isRemoved) {
                        removedFields.push(field);
                    }
                    return !isRemoved;
                });
            }
            const removedRelationships = [];
            if (changelog.removedRelationships) {
                context.relationships = context.relationships.filter(rel => {
                    const isRemoved = changelog.removedRelationships.includes(`${rel.relationshipName}:${rel.relationshipType}`);
                    if (isRemoved) {
                        removedRelationships.push(rel);
                    }
                    return !isRemoved;
                });
            }
            if (returnRemoved) {
                context.removedFields = removedFields;
                context.removedRelationships = removedRelationships;
            }
            if (changelog.addedFields) {
                context.fields = context.fields.concat(changelog.addedFields);
            }
            if (changelog.addedRelationships) {
                context.relationships = context.relationships.concat(changelog.addedRelationships);
            }
        });
        return context;
    },

    /**
     * Create a relationship wrapper for calculating relationship info.
     * @param {Object} relationship - Relationship definition
     * @param {String} jhiPrefix - jhiprefix
     * @param {String} prodDatabaseType - Production database type
     * @param {String} untilChangelogDate - Reference changelogDate
     * @returns {Object} The relationship wrapper
     */
    dbRelationshipWrapper(relationship, jhiPrefix, prodDatabaseType, untilChangelogDate) {
        const self = this;
        return {
            get otherSide() {
                if (!this._otherSide) {
                    this._otherSide = self.loadDatabaseChangelogEntity(_.upperFirst(relationship.otherEntityName, untilChangelogDate));
                }
                return this._otherSide;
            },
            get relationshipName() {
                return relationship.relationshipName;
            },
            get relationshipType() {
                return relationship.relationshipType;
            },
            get otherEntityName() {
                return relationship.otherEntityName;
            },
            get otherEntityPrimaryKeyType() {
                return relationship.otherEntityPrimaryKeyType;
            },
            get relationshipValidate() {
                return (
                    relationship.relationshipValidate ||
                    (relationship.relationshipValidateRules && relationship.relationshipValidateRules.includes('required'))
                );
            },
            get relationshipRequired() {
                return relationship.relationshipValidateRules && relationship.relationshipValidateRules.includes('required');
            },
            get ownerSide() {
                return relationship.ownerSide;
            },
            get useJPADerivedIdentifier() {
                return relationship.useJPADerivedIdentifier;
            },
            get columnName() {
                return self.getColumnName(this.relationshipName);
            },
            getColumnType(authenticationType) {
                return this.otherEntityName === 'user' && authenticationType === 'oauth2' ? 'varchar(100)' : 'bigint';
            },
            getUniqueConstraintName(entityTableName) {
                return self.getUXConstraintName(entityTableName, `${this.columnName}_id`, prodDatabaseType);
            },
            get otherEntityNameCapitalized() {
                return relationship.otherEntityNameCapitalized || _.upperFirst(this.otherEntityName);
            },
            get nullable() {
                return this.isNullable();
            },
            isNullable() {
                return !(this.relationshipValidate === true && this.relationshipRequired);
            },
            isUnique() {
                return this.relationshipType === 'one-to-one' && this.shouldWriteRelationship();
            },
            shouldWriteRelationship() {
                return (
                    this.relationshipType === 'many-to-one' ||
                    (this.relationshipType === 'one-to-one' && this.ownerSide === true && !this.useJPADerivedIdentifier)
                );
            },
            shouldWriteJoinTable() {
                return this.relationshipType === 'many-to-many' && this.ownerSide;
            },
            get otherEntityTableName() {
                if (relationship.otherEntityTableName) {
                    return relationship.otherEntityTableName;
                }
                if (this.otherEntityName === 'user') {
                    return `${self.getTableName(jhiPrefix)}_user`;
                }

                return this.otherSide.entityTableName || self.getTableName(this.otherSide.name);
            },
            shouldCreateJoinTable() {
                return this.relationshipType === 'many-to-many' && this.ownerSide;
            }
        };
    },

    entityWrapper(entity) {
        const self = this;
        return {
            get name() {
                return entity.name;
            },
            get entityNameCapitalized() {
                return _.upperFirst(this.name);
            },
            get entityClass() {
                return this.entityNameCapitalized;
            },
            get entityTableName() {
                return entity.entityTableName || self.getTableName(this.name);
            },
            get javadoc() {
                return entity.javadoc;
            },
            get fieldsContainOwnerManyToMany() {
                return entity.relationships.find(rel => rel.relationshipType === 'many-to-many' && rel.ownerSide);
            },
            get fieldsContainOwnerOneToOne() {
                return entity.relationships.find(rel => rel.relationshipType === 'one-to-one' && rel.ownerSide);
            },
            get fieldsContainNoOwnerOneToOne() {
                return entity.relationships.find(rel => rel.relationshipType === 'one-to-one' && !rel.ownerSide);
            },
            get fieldsContainManyToMany() {
                return entity.relationships.find(rel => rel.relationshipType === 'many-to-many');
            },
            get fieldsContainOneToMany() {
                return entity.relationships.find(rel => rel.relationshipType === 'one-to-many');
            },
            get fieldsContainManyToOne() {
                return entity.relationships.find(rel => rel.relationshipType === 'many-to-one');
            }
        };
    },

    /**
     * Create a field wrapper for calculating column info.
     * @param {Object} field - Field definition
     * @param {String} jhiPrefix - jhiprefix
     * @param {String} prodDatabaseType - Production database type
     * @returns {Object} The field wrapper
     */
    dbFieldWrapper(field, jhiPrefix, prodDatabaseType) {
        const self = this;
        return {
            get fieldValidateRules() {
                return field.fieldValidateRules;
            },
            get fieldValidate() {
                return _.isArray(this.fieldValidateRules) && this.fieldValidateRules.length >= 1;
            },
            get unique() {
                return this.fieldValidate === true && this.fieldValidateRules.includes('unique');
            },
            get fieldValidateRulesMax() {
                return field.fieldValidateRulesMax;
            },
            get fieldValidateRulesMin() {
                return field.fieldValidateRulesMin;
            },
            get fieldValidateRulesMinlength() {
                return field.fieldValidateRulesMinlength;
            },
            get fieldValidateRulesMaxlength() {
                return field.fieldValidateRulesMaxlength;
            },
            get maxlength() {
                if (this.fieldValidate === true && this.fieldValidateRules.includes('maxlength')) {
                    return this.fieldValidateRulesMaxlength;
                }
                return 255;
            },
            get fieldValidateRulesPattern() {
                return field.fieldValidateRulesPattern;
            },
            get fieldType() {
                return field.fieldType;
            },
            get fieldTypeBlobContent() {
                return field.fieldTypeBlobContent;
            },
            get fieldValues() {
                return field.fieldValues;
            },
            get fieldIsEnum() {
                return ![
                    'String',
                    'Integer',
                    'Long',
                    'Float',
                    'Double',
                    'BigDecimal',
                    'LocalDate',
                    'Instant',
                    'ZonedDateTime',
                    'Duration',
                    'UUID',
                    'Boolean',
                    'byte[]',
                    'ByteBuffer'
                ].includes(this.fieldType);
            },
            get javadoc() {
                return field.javadoc;
            },
            get nullable() {
                return this.isNullable();
            },
            isNullable() {
                return !(this.fieldValidate === true && this.fieldValidateRules.includes('required'));
            },
            shouldDropDefaultValue() {
                return this.fieldType === 'ZonedDateTime' || this.fieldType === 'Instant';
            },
            shouldCreateContentType() {
                return this.fieldType === 'byte[]' && this.fieldTypeBlobContent !== 'text';
            },
            getUXConstraintName(entityTableName) {
                return self.getUXConstraintName(entityTableName, this.columnName, prodDatabaseType);
            },
            get columnName() {
                const fieldNameUnderscored = _.snakeCase(field.fieldName);
                const jhiFieldNamePrefix = self.getColumnName(jhiPrefix);
                if (jhiCore.isReservedTableName(fieldNameUnderscored, prodDatabaseType)) {
                    if (!jhiFieldNamePrefix) {
                        this.warning(
                            chalk.red(
                                `The field name '${fieldNameUnderscored}' is regarded as a reserved keyword, but you have defined an empty jhiPrefix. This might lead to a non-working application.`
                            )
                        );
                        return fieldNameUnderscored;
                    }
                    return `${jhiFieldNamePrefix}_${fieldNameUnderscored}`;
                }
                return fieldNameUnderscored;
            },
            get loadColumnType() {
                const columnType = this.columnType;
                if (
                    columnType === 'integer' ||
                    columnType === 'bigint' ||
                    columnType === 'double' ||
                    columnType === 'decimal(21,2)' ||
                    // eslint-disable-next-line no-template-curly-in-string
                    columnType === '${floatType}'
                ) {
                    return 'numeric';
                }
                if (columnType === 'date') {
                    return 'date';
                }
                if (columnType === 'datetime') {
                    return 'datetime';
                }
                if (columnType === 'boolean') {
                    return 'boolean';
                }
                if (this.fieldIsEnum) {
                    return 'string';
                }
                if (columnType === 'blob' || columnType === 'longblob') {
                    return 'blob';
                }
                // eslint-disable-next-line no-template-curly-in-string
                if (columnType === '${clobType}') {
                    return 'clob';
                }
                // eslint-disable-next-line no-template-curly-in-string
                if (columnType === '${uuidType}' && prodDatabaseType !== 'mysql' && prodDatabaseType !== 'mariadb') {
                    // eslint-disable-next-line no-template-curly-in-string
                    return '${uuidType}';
                }
                return 'string';
            },
            get columnType() {
                const fieldType = this.fieldType;
                if (fieldType === 'String' || this.fieldIsEnum) {
                    return `varchar(${this.maxlength})`;
                }
                if (fieldType === 'Integer') {
                    return 'integer';
                }
                if (fieldType === 'Long') {
                    return 'bigint';
                }
                if (fieldType === 'Float') {
                    // eslint-disable-next-line no-template-curly-in-string
                    return '${floatType}';
                }
                if (fieldType === 'Double') {
                    return 'double';
                }
                if (fieldType === 'BigDecimal') {
                    return 'decimal(21,2)';
                }
                if (fieldType === 'LocalDate') {
                    return 'date';
                }
                if (fieldType === 'Instant') {
                    return 'datetime';
                }
                if (fieldType === 'ZonedDateTime') {
                    return 'datetime';
                }
                if (fieldType === 'Duration') {
                    return 'bigint';
                }
                if (fieldType === 'UUID') {
                    // eslint-disable-next-line no-template-curly-in-string
                    return '${uuidType}';
                }
                if (fieldType === 'byte[]' && this.fieldTypeBlobContent !== 'text') {
                    if (prodDatabaseType === 'mysql' || prodDatabaseType === 'postgresql' || prodDatabaseType === 'mariadb') {
                        return 'longblob';
                    }
                    return 'blob';
                }
                if (this.fieldTypeBlobContent === 'text') {
                    // eslint-disable-next-line no-template-curly-in-string
                    return '${clobType}';
                }
                if (fieldType === 'Boolean') {
                    return 'boolean';
                }
                return undefined;
            }
        };
    }
};
