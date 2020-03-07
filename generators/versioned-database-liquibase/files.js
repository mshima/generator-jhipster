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
const faker = require('faker');

const utils = require('../utils');
const constants = require('../generator-constants');

/* Use customized randexp */
const randexp = utils.RandexpWithFaker;

/* Constants use throughout */
const INTERPOLATE_REGEX = constants.INTERPOLATE_REGEX;
const SERVER_MAIN_RES_DIR = constants.SERVER_MAIN_RES_DIR;

/*
 * Current faker version is 4.1.0 and was release in 2017
 * It is outdated
 * https://github.com/Marak/faker.js/blob/10bfb9f467b0ac2b8912ffc15690b50ef3244f09/lib/date.js#L73-L96
 * Needed for reproducible builds
 */
const getRecentDate = function(days, refDate) {
    let date = new Date();
    if (refDate !== undefined) {
        date = new Date(Date.parse(refDate));
    }

    const range = {
        min: 1000,
        max: (days || 1) * 24 * 3600 * 1000
    };

    let future = date.getTime();
    future -= faker.random.number(range); // some time from now to N days ago, in milliseconds
    date.setTime(future);

    return date;
};

const getRecentForLiquibase = function(days, changelogDate) {
    let formatedDate;
    if (changelogDate !== undefined) {
        formatedDate = `${changelogDate.substring(0, 4)}-${changelogDate.substring(4, 6)}-${changelogDate.substring(
            6,
            8
        )}T${changelogDate.substring(8, 10)}:${changelogDate.substring(10, 12)}:${changelogDate.substring(12, 14)}+00:00`;
    }
    return getRecentDate(1, formatedDate);
};

const liquibaseFiles = {
    dbChangelog: [
        {
            condition: generator => generator.databaseType === 'sql',
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/liquibase/changelog/added_entity.xml',
                    options: { interpolate: INTERPOLATE_REGEX },
                    renameTo: generator => `config/liquibase/changelog/${generator.changelogDate}_added_entity_${generator.entityClass}.xml`
                }
            ]
        },
        {
            condition: generator =>
                generator.databaseType === 'sql' &&
                (generator.fieldsContainOwnerManyToMany || generator.fieldsContainOwnerOneToOne || generator.fieldsContainManyToOne),
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/liquibase/changelog/added_entity_constraints.xml',
                    options: { interpolate: INTERPOLATE_REGEX },
                    renameTo: generator =>
                        `config/liquibase/changelog/${generator.changelogDate}_added_entity_constraints_${generator.entityClass}.xml`
                }
            ]
        }
    ]
};

const updateLiquibaseFiles = {
    dbChangelog: [
        {
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/liquibase/changelog/updated_entity.xml',
                    options: { interpolate: INTERPOLATE_REGEX },
                    renameTo: generator =>
                        `config/liquibase/changelog/${generator.liquibaseChangelog.changelogDate}_updated_entity_${generator.entity.entityClass}.xml`
                }
            ]
        },
        {
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/liquibase/changelog/updated_entity_constraints.xml',
                    options: { interpolate: INTERPOLATE_REGEX },
                    renameTo: generator =>
                        `config/liquibase/changelog/${generator.liquibaseChangelog.changelogDate}_updated_entity_constraints_${generator.entity.entityClass}.xml`
                }
            ]
        },
        {
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/liquibase/changelog/updated_entity_migrate.xml',
                    options: { interpolate: INTERPOLATE_REGEX },
                    renameTo: generator =>
                        `config/liquibase/changelog/${generator.liquibaseChangelog.changelogDate}_updated_entity_migrate_${generator.entity.entityClass}.xml`
                }
            ]
        }
    ]
};

const updateFakeFiles = {
    fakeData: [
        {
            condition: generator => generator.writeFakeData,
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/liquibase/fake-data/table_entity.csv',
                    options: {
                        interpolate: INTERPOLATE_REGEX,
                        context: {
                            getRecentForLiquibase,
                            faker,
                            randexp
                        }
                    },
                    renameTo: generator =>
                        `config/liquibase/fake-data/${generator.liquibaseChangelog.changelogDate}_entity_${generator.entity.entityTableName}.csv`
                }
            ]
        },
        {
            condition: generator =>
                generator.databaseType === 'sql' &&
                !generator.skipFakeData &&
                (generator.fieldsContainImageBlob === true || generator.fieldsContainBlob === true),
            path: SERVER_MAIN_RES_DIR,
            templates: [{ file: 'config/liquibase/fake-data/blob/hipster.png', method: 'copy', noEjs: true }]
        },
        {
            condition: generator => generator.databaseType === 'sql' && !generator.skipFakeData && generator.fieldsContainTextBlob === true,
            path: SERVER_MAIN_RES_DIR,
            templates: [{ file: 'config/liquibase/fake-data/blob/hipster.txt', method: 'copy' }]
        }
    ]
};

module.exports = {
    writeFiles,
    liquibaseFiles
};

function writeLiquibaseFiles() {
    // write initial liquibase files
    this.writeFilesToDisk(liquibaseFiles, this, false, this.fetchFromInstalledJHipster('versioned-database-liquibase/templates'));
    this.writeFilesToDisk(updateFakeFiles, this, false, this.fetchFromInstalledJHipster('versioned-database-liquibase/templates'));

    const fileName = `${this.changelogDate}_added_entity_${this.entityClass}`;
    // When the file was imported by liquibase generator, then relationships are moved to another changelog
    // So keep it ordered by date.
    this.addNewChangelogToLiquibase(fileName);

    if (this.fieldsContainOwnerManyToMany || this.fieldsContainOwnerOneToOne || this.fieldsContainManyToOne) {
        const constFileName = `${this.changelogDate}_added_entity_constraints_${this.entityClass}`;
        this.addNewChangelogToLiquibase(constFileName);
    }
}

function writeUpdateFiles(updatedEntity) {
    const changelogDate = this.liquibaseChangelog.changelogDate;
    this.addedDbFields = (this.liquibaseChangelog.addedFields || []).map(field =>
        this.dbFieldWrapper(field, this.jhiPrefix, this.prodDatabaseType)
    );
    this.fields = this.addedDbFields;
    this.removedDbFields = (updatedEntity.removedFields || []).map(field =>
        this.dbFieldWrapper(field, this.jhiPrefix, this.prodDatabaseType)
    );
    this.addedDbRelationships = (this.liquibaseChangelog.addedRelationships || []).map(relationship =>
        this.dbRelationshipWrapper(relationship, this.jhiPrefix, this.prodDatabaseType, changelogDate)
    );
    this.relationships = this.addedDbRelationships;
    this.removedDbRelationships = (updatedEntity.removedRelationships || []).map(relationship =>
        this.dbRelationshipWrapper(relationship, this.jhiPrefix, this.prodDatabaseType, changelogDate)
    );

    this.writeFakeData =
        !this.skipFakeData &&
        ((this.addedDbFields && this.addedDbFields.length) || (this.addedDbRelationships && this.addedDbRelationships.length));

    this.writeFilesToDisk(updateLiquibaseFiles, this, false, this.fetchFromInstalledJHipster('versioned-database-liquibase/templates'));
    this.writeFilesToDisk(updateFakeFiles, this, false, this.fetchFromInstalledJHipster('versioned-database-liquibase/templates'));

    this.addNewChangelogToLiquibase(`${this.liquibaseChangelog.changelogDate}_updated_entity_${this.entity.entityClass}`);
    this.addNewChangelogToLiquibase(`${this.liquibaseChangelog.changelogDate}_updated_entity_migrate_${this.entity.entityClass}`);
    this.addNewChangelogToLiquibase(`${this.liquibaseChangelog.changelogDate}_updated_entity_constraints_${this.entity.entityClass}`);
}

function writeFiles() {
    return {
        setupReproducibility() {
            if (this.skipServer || !this.options.databaseChangelog.entityName) return;

            // In order to have consistent results with Faker, restart seed with current entity name hash.
            faker.seed(utils.stringHashCode(this.options.databaseChangelog.entityName.toLowerCase()));
        },

        writeLiquibaseFiles() {
            const config = (this.allConfig = this.config.getAll());
            if (config.skipServer || config.databaseType !== 'sql') return;

            const liquibaseChangelog = this.options.databaseChangelog;
            const entityName = liquibaseChangelog.entityName;
            const changelogDate = liquibaseChangelog.changelogDate;

            Object.assign(this, {
                liquibaseChangelog,
                databaseType: config.databaseType,
                skipFakeData: config.skipFakeData,
                prodDatabaseType: config.prodDatabaseType,
                authenticationType: config.authenticationType,
                jhiPrefix: config.jhiPrefix
            });

            if (liquibaseChangelog.type === 'custom') {
                this._writeCustomChangelog(liquibaseChangelog);
            } else if (liquibaseChangelog.type === 'entity-snapshot') {
                this._writeCustomChangelog(liquibaseChangelog, 'snapshot');
            } else if (liquibaseChangelog.type === 'tag') {
                this._writeCustomChangelog(liquibaseChangelog, 'tag');
            } else if (liquibaseChangelog.type === 'entity-new') {
                const updatedEntity = this.loadDatabaseChangelogEntity(entityName, changelogDate);

                this.primaryKeyType = this.getPkTypeBasedOnDBAndAssociation(
                    config.authenticationType,
                    config.databaseType,
                    updatedEntity.relationships
                );

                updatedEntity.name = updatedEntity.name || entityName;
                this.fields = updatedEntity.fields.map(field => this.dbFieldWrapper(field, this.jhiPrefix, this.prodDatabaseType));
                this.relationships = updatedEntity.relationships.map(relationship =>
                    this.dbRelationshipWrapper(relationship, this.jhiPrefix, this.prodDatabaseType, liquibaseChangelog.changelogDate)
                );

                const entity = (this.entity = this.entityWrapper(updatedEntity));
                this.changelogDate = liquibaseChangelog.changelogDate;
                [
                    'entityClass',
                    'javadoc',
                    'entityTableName',
                    'name',
                    'fieldsContainOwnerManyToMany',
                    'fieldsContainOwnerOneToOne',
                    'fieldsContainNoOwnerOneToOne',
                    'fieldsContainManyToMany',
                    'fieldsContainOneToMany',
                    'fieldsContainManyToOne'
                ].forEach(field => {
                    this[field] = entity[field];
                });

                writeLiquibaseFiles.call(this);
            } else if (liquibaseChangelog.type.startsWith('entity-')) {
                const updatedEntity = this.loadDatabaseChangelogEntity(entityName, changelogDate, true);

                this.primaryKeyType = this.getPkTypeBasedOnDBAndAssociation(
                    config.authenticationType,
                    config.databaseType,
                    updatedEntity.relationships
                );

                this.entity = this.entityWrapper(updatedEntity);
                writeUpdateFiles.call(this, updatedEntity);
            } else {
                this.env.error(`Changelog of type ${liquibaseChangelog.type} not implemented`);
            }
        }
    };
}
