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
const assert = require('assert');
const chalk = require('chalk');
const fse = require('fs-extra');

const BaseGenerator = require('../generator-base');
const constants = require('../generator-constants');

const SERVER_MAIN_RES_DIR = constants.SERVER_MAIN_RES_DIR;

module.exports = class extends BaseGenerator {
    constructor(args, opts) {
        super(args, opts);

        this.configOptions = this.options.configOptions || {};

        this.argument('init', {
            type: String,
            required: false,
            description: 'Initialize versioned database'
        });

        this.argument('apply', {
            type: String,
            required: false,
            description: 'External file to apply'
        });

        this.argument('drop', {
            type: Boolean,
            required: false,
            description: 'Drop changelog'
        });

        this.argument('merge', {
            type: Boolean,
            required: false,
            description: 'Drop changelog'
        });

        this.argument('customChangelog', {
            type: String,
            required: false,
            description: 'Add a custom changelog entry to master.xml'
        });

        this.argument('snapshot', {
            type: String,
            required: false,
            description: 'Add a changelog breaking point for custom changes'
        });

        this.argument('tag', {
            type: String,
            required: false,
            description: 'Create a tag changelog'
        });

        this.argument('squash', {
            type: Boolean,
            required: false,
            description: 'Squash changelogs using last tag as reference'
        });

        // This adds support for a `--from-cli` flag
        this.option('from-cli', {
            desc: 'Indicates the command is run from JHipster CLI',
            type: Boolean,
            defaults: false
        });

        this.option('regenerate', {
            desc: 'Regenerate the changelog',
            type: Boolean,
            defaults: false
        });

        this.option('update', {
            desc: 'Update based on the current entity',
            type: Boolean,
            defaults: false
        });

        this.option('generate', {
            desc: 'Generate the changelog',
            type: Boolean,
            defaults: false
        });

        this.option('entity', {
            desc: 'Name of the entity to update',
            type: String
        });

        this.option('new-entity', {
            desc: 'Create a new changelog for the entity',
            type: Boolean,
            defaults: false
        });

        this.registerPrettierTransform();
        this.changelogConfig = this.createStorage('.yo-rc.json', 'generator-jhipster.databaseChangelogs', true);
    }

    _initializing() {
        return {
            validateFromCli() {
                this.checkInvocationFromCLI();
            },

            /**
             * Display jhipster logo
             */
            displayLogo() {
                if (this.logo) {
                    this.printJHipsterLogo();
                }
            },

            /**
             * Validate if current version is using versioned database.
             */
            initializeConfig() {
                let versionedDatabase = this.config.get('versionedDatabase');
                if (versionedDatabase) {
                    return;
                }
                versionedDatabase = this.options.init;
                if (!versionedDatabase) {
                    throw new Error('Incremental changelog is not enabled for this project');
                }
                versionedDatabase = typeof versionedDatabase === 'string' ? versionedDatabase : 'liquibase';
                // Set skipDbChangelog so changelogs will be ignored at entity-* generators.
                this.config.set('skipDbChangelog', true);
                // Set versionedDatabase to true.
                this.config.set('versionedDatabase', versionedDatabase);
            }
        };
    }

    get initializing() {
        return this._initializing();
    }

    _prompting() {
        return {};
    }

    get prompting() {
        return this._prompting();
    }

    _configuring() {
        return {
            /**
             * Convert a project to a versioned database.
             */
            initializeIncrementalChangelog() {
                const changelogs = this.changelogConfig.getAll();
                if (changelogs !== undefined && Object.keys(changelogs).length > 0) {
                    return;
                }
                this._debug('Initializing incremental changelog');
                this.getExistingEntities().forEach(entity => {
                    const changelogDate = entity.definition.changelogDate;
                    if (this.changelogConfig.get(changelogDate)) {
                        throw new Error(`Duplicate changelogDate ${changelogDate}`);
                    }
                    const changelog = this._createChangelogContext('entity-new', entity.name, changelogDate);
                    changelog.set('definition', entity.definition);
                    changelog.save();
                });
                this.fullRegeneration = true;
            },

            /**
             * Loads last changelogDate
             */
            initChangelogDate() {
                this._loadLastChangelogDate();
            },

            /**
             * Create new entity.
             */
            createNewEntity() {
                const { newEntity, entity: entityName } = this.options;
                if (!newEntity) {
                    return;
                }
                assert(entityName, 'Entity name is required');
                this._debug(`Creating a new changelog for entity ${entityName}`);
                const definition = this.fs.readJSON(`.jhipster/${entityName}.json`);
                this._debug(definition);
                const changelogDate = definition.changelogDate;
                if (this.changelogConfig.get(changelogDate)) {
                    throw new Error(`Duplicate changelogDate ${changelogDate}`);
                }
                const changelog = this._createChangelogContext('entity-new', entityName, changelogDate);
                changelog.set('definition', definition);
                changelog.save();
                this._writeChangelog(changelog.getChangelog());
            },

            /**
             * Calculate new changelog.
             */
            updateChangelogsFromEntities() {
                const { update, entity: entityName } = this.options;
                if (!update) {
                    return;
                }
                let entities = this.getExistingEntities();
                if (entityName) {
                    this._debug(`Found entities ${entities.map(entity => entity.name).join(', ')}`);
                    this._debug(`Filtering entity ${entityName}`);
                    entities = entities.filter(entity => entity.name === entityName);
                }
                this._debug(`Updating or creating changelog for ${entities.map(entity => entity.name).join(', ')}`);
                const changelogs = this._generateChangelogFromDiff(entities);
                if (entityName) {
                    // If entityName, this generator was called by entity generator, so write the changelog
                    changelogs.forEach(changelog => this._writeChangelog(changelog));
                }
            },

            /**
             * Apply external changelogs
             */
            applyExternalChangelogs() {
                if (!this.options.apply) {
                    return;
                }
                const externalFile = fse.readJsonSync(this.options.apply);
                const changelogEntityNames = Object.values(externalFile)
                    .map(changelog => changelog.entityName)
                    .filter(entityName => entityName);
                this.appliedChangelogs = [...new Set(changelogEntityNames)];
                this.changelogConfig.set(externalFile);
                this.fullRegeneration = this.appliedChangelogs.length > 0;
            },

            /**
             * Validate current changelogs
             */
            validateChangelogs() {
                this.loadDatabaseChangelogs().forEach(changelog => {
                    if (!changelog.changelogDate) {
                        throw new Error('Changelog must have a changelogDate');
                    }
                    if (!changelog.type) {
                        throw new Error('Changelog must have a type');
                    }
                });
            },

            /**
             * Consolidate applied changelogs.
             */
            applyChangelogs() {
                if (!this.options.apply) {
                    return;
                }
                this.appliedChangelogs.forEach(entityName => {
                    const entityConfig = this.createStorage(`.jhipster/${entityName}.json`);
                    // Update entity definition.
                    entityConfig.set(this.loadDatabaseChangelogEntity(entityName));
                });
            }
        };
    }

    get configuring() {
        return this._configuring();
    }

    _default() {
        return {
            askPrompts() {
                const { newEntity, generate, regenerate, update, init, apply } = this.options;
                if (newEntity || generate || regenerate || update || init || apply) {
                    return;
                }
                if (this.options.drop) {
                    this._askDrop();
                    return;
                }
                if (this.options.merge) {
                    this._askMerge();
                    return;
                }
                if (this.options.customChangelog) {
                    const databaseContext = this._createChangelogContext('custom', this.options.customChangelog);
                    databaseContext.save(true);
                    this._writeChangelog(databaseContext.getChangelog());
                    return;
                }
                if (this.options.tag) {
                    const databaseContext = this._createChangelogContext('tag', this.options.tag);
                    databaseContext.save(true);
                    this._writeChangelog(databaseContext.getChangelog());
                    return;
                }
                if (this.options.squash) {
                    const toSquash = this._loadNotBreakingChangelogs();
                    // Unique entities
                    const entities = [...new Set(toSquash.map(changelog => changelog.entityName))];
                    entities.forEach(entity => {
                        const entityChangelogs = toSquash.filter(changelog => changelog.entityName === entity).filter(ch => ch);
                        if (entityChangelogs.length > 1) {
                            const newChangelog = this._createChangelogContext('entity-changes', entity);
                            entityChangelogs.unshift(newChangelog.getChangelog());
                            const self = this;
                            this.queueTask({
                                queueName: 'default',
                                taskName: 'confirm-merge',
                                method: () => {
                                    return self._confirmMerge(self._mergeChangelogs(entityChangelogs));
                                }
                            });
                        }
                    });
                    return;
                }
                if (this.options.snapshot) {
                    const entityName = this.options.snapshot;
                    const entity = this.loadDatabaseChangelogEntity(entityName);
                    if (!entity) {
                        this.env.error(`Entity ${entityName} was not found`);
                    }
                    const databaseContext = this._createChangelogContext('entity-snapshot', entityName);
                    databaseContext.set('definition', entity.definition);
                    databaseContext.save(true);
                    this._writeChangelog(databaseContext.getChangelog());
                }
            }
        };
    }

    get default() {
        return this._default();
    }

    _writing() {
        return {
            regenerate() {
                if (this.fullRegeneration) {
                    const configOptions = this.options.configOptions;
                    this.composeWith(require.resolve('../app'), {
                        'with-entities': true,
                        configOptions,
                        updateVersionedDatabase: false,
                        'from-cli': true,
                        'skip-install': true,
                        debug: this.isDebugEnabled
                    });
                    // A full regeneration is queued, stop this generator.
                    this.cancelCancellableTasks();
                    return;
                }
                const { regenerate } = this.options;
                if (!regenerate) {
                    return;
                }
                this._regenerate();
            }
        };
    }

    get writing() {
        return this._writing();
    }

    _install() {
        return {};
    }

    get install() {
        return this._install();
    }

    _end() {
        return {};
    }

    get end() {
        return this._end();
    }

    /* ======================================================================== */
    /* private methods use within generator                                     */
    /* ======================================================================== */

    _writeChangelog(databaseChangelog) {
        this._debug('Regenerating changelog %s', databaseChangelog.changelogDate);
        const versionedDatabase = this.config.get('versionedDatabase');
        const generator = versionedDatabase === 'liquibase' ? require.resolve('../versioned-database-liquibase') : versionedDatabase;
        this.composeWith(generator, { databaseChangelog });
    }

    _loadLastChangelogDate() {
        const changelog = this.loadDatabaseChangelogs().pop();
        if (!changelog) {
            return;
        }
        const changelogDate = changelog.changelogDate;
        if (!this.configOptions.lastReturnedFormattedDate || this.configOptions.lastReturnedFormattedDate < changelogDate) {
            this.configOptions.lastReturnedFormattedDate = changelogDate;
        }
    }

    /**
     * Load with order by date with a start point (last ocurrence)
     * @param {any} [startPoint] - Break point to use
     * @param {String} [entityName] - Entity name to filter
     * @returns {Array} Array of changelogs
     */
    _loadNotBreakingChangelogs(startPoint, entityName) {
        let breakingChangelog;
        if (!startPoint) {
            breakingChangelog = changelog =>
                !changelog.type.startsWith('entity-') || changelog.type === 'entity-snapshot' || changelog.type === 'entity-new';
        } else if (typeof startPoint === 'boolean') {
            breakingChangelog = changelog => changelog.type === 'tag';
        } else if (Array.isArray(startPoint)) {
            breakingChangelog = changelog => startPoint.includes(changelog.type);
        } else if (typeof startPoint === 'function') {
            breakingChangelog = startPoint;
        }

        let filter;
        if (entityName) {
            filter = changelog => changelog.entityName === entityName;
        }
        const notBreaking = [];
        this.loadDatabaseChangelogs(filter)
            .reverse()
            .find(changelog => {
                if (breakingChangelog(changelog)) {
                    return true;
                }
                notBreaking.unshift(changelog);
                return false;
            });
        return notBreaking;
    }

    /**
     * Creates a new changelog definition.
     * @param {String} type - Type of the changelog
     * @param {String} name - Name of the changelog or name of the entity
     * @returns {Object} The changelog base definition
     */
    _createChangelogContext(type, name, changelogDate = this.dateFormatForLiquibase()) {
        if (!changelogDate) {
            throw new Error('No current changelog was found.');
        }

        const context = { type, changelogDate };
        if (type === 'custom' || type === 'tag') {
            context.name = name;
        } else if (type.startsWith('entity-')) {
            context.entityName = name;
        } else {
            // Add entity-snapshot, tag
            throw new Error(`Changelog of type ${type} not implemented`);
        }

        let hasChanged = false;
        const self = this;
        return {
            getChangelog() {
                return context;
            },
            get(key) {
                return context[key];
            },
            set(key, value) {
                hasChanged = true;
                context[key] = value;
            },
            save(force = false) {
                if (!force && !hasChanged) return false;
                self.changelogConfig.set(context.changelogDate, context);
                return true;
            }
        };
    }

    /**
     * Ask changelog drop prompts
     */
    _askDrop() {
        this.queueTaskGroup(
            {
                prompts() {
                    const dropAvailable = this._loadNotBreakingChangelogs(true).reverse();
                    const prompts = [
                        {
                            type: 'checkbox',
                            choices: dropAvailable.map(changelog => {
                                return {
                                    name: `${changelog.changelogDate}-${changelog.entityName}: ${JSON.stringify(changelog)}`,
                                    value: changelog.changelogDate
                                };
                            }),
                            name: 'dropedChangelogs',
                            message: 'Which changelog do you want to drop?',
                            pageSize: 20
                        }
                    ];
                    return this.prompt(prompts).then(answers => {
                        if (answers.dropedChangelogs.length) {
                            answers.dropedChangelogs.forEach(this._dropChangelog.bind(this));
                            this.fullRegeneration = true;
                        }
                    });
                }
            },
            { queueName: 'default' }
        );
    }

    /**
     * Drop a changelog from .yo-rc.json
     * @param {String} changelogDate - The changelogDate to drop.
     */
    _dropChangelog(changelogDate) {
        this.changelogConfig.delete(changelogDate);
        this.removeFile(`${SERVER_MAIN_RES_DIR}/config/liquibase/changelog/${changelogDate}_*.xml`, false);
        this.fullRegeneration = true;
    }

    /**
     * Ask merge changelog prompts
     */
    _askMerge() {
        const self = this;
        this.queueTaskGroup(
            {
                prompts() {
                    const mergeAvailable = this._loadNotBreakingChangelogs(true).reverse();
                    const prompts = [
                        {
                            when: Object.keys(this.changelogConfig.getAll()).length,
                            type: 'list',
                            choices: () => {
                                let entityNames = mergeAvailable.map(val => val.entityName).filter(choice => choice);
                                // Unique
                                entityNames = Array.from(new Set(entityNames));
                                return entityNames.sort();
                            },
                            name: 'entityToMerge',
                            message: 'Which entity do you want to merge?'
                        },
                        {
                            type: 'checkbox',
                            choices: answers => {
                                const changelogs = self
                                    ._loadNotBreakingChangelogs(['tags', 'entity-new', 'entity-snapshot'], answers.entityToMerge)
                                    .reverse();
                                return changelogs.map(value => {
                                    return {
                                        name: `${value.entityName}-${value.changelogDate}: ${JSON.stringify(value)}`,
                                        value: value.changelogDate
                                    };
                                });
                            },
                            name: 'changelogsToMerge',
                            message: 'Which changelog do you want to merge?',
                            pageSize: 20
                        }
                    ];

                    return this.prompt(prompts).then(answers => {
                        return this._mergeChangelogsDates(answers.changelogsToMerge.reverse());
                    });
                }
            },
            { queueName: 'default' }
        );
    }

    /**
     * Merges more then one changelog into one.
     * @param {Array} changelogsDatesToMerge - Changelog dates to merge
     * @returns {Promise} Prompt promise
     */
    _mergeChangelogsDates(changelogsDatesToMerge) {
        if (!changelogsDatesToMerge || changelogsDatesToMerge.length < 2) {
            this.log(`\n${chalk.bold.green('You need to select at least 2 changelogs to merge\n')}`);
            return undefined;
        }
        changelogsDatesToMerge.sort();
        const databaseChangelog = this.changelogConfig.getAll();
        const changelogsToMerge = changelogsDatesToMerge.map(changelogDate => {
            const changelog = databaseChangelog[changelogDate];
            if (!changelog) {
                const msg = `Changelog ${changelogDate} was not found\n`;
                this.env.error(`\n${chalk.bold.green(msg)}`);
            }
            return changelog;
        });
        return this._confirmMerge(this._mergeChangelogs(changelogsToMerge));
    }

    /**
     * Merges more then one changelog into one.
     * @param {Array} changelogsToMerge - Changelogs to merge, they are merged into the first one.
     * @returns {Promise} Prompt promise
     */
    _mergeChangelogs(changelogsToMerge) {
        if (!changelogsToMerge || changelogsToMerge.length < 2) {
            this.log(`\n${chalk.bold.green('You need to select at least 2 changelogs to merge\n')}`);
            return undefined;
        }
        const mergeArrays = function(dest, source, field) {
            if (source[field]) {
                dest[field] = (dest[field] || []).concat(source[field]);
            }
        };

        const dest = changelogsToMerge.shift();
        const original = { ...dest };
        changelogsToMerge.forEach(source => {
            ['addedFields', 'removedFields', 'addedRelationships', 'removedRelationships'].forEach(
                mergeArrays.bind(undefined, dest, source)
            );
        });
        changelogsToMerge.unshift(original);
        return { dest, changelogsToMerge };
    }

    _confirmMerge(mergeData) {
        return this.prompt([
            {
                type: 'confirm',
                name: 'confirmMerge',
                message: `Changelogs:
${JSON.stringify(mergeData.changelogsToMerge, null, 2)}
Will be replaced by:
${JSON.stringify(mergeData.dest, null, 2)}
Do you confirm?`,
                default: false
            }
        ]).then(answers => {
            if (answers.confirmMerge) {
                mergeData.changelogsToMerge.forEach(changelog => this._dropChangelog(changelog.changelogDate));
                const changelog = mergeData.dest;
                this.changelogConfig.set(changelog.changelogDate, changelog);
                this.fullRegeneration = true;
            }
        });
    }

    /**
     * Regenerate changelogs.
     */
    _regenerate() {
        const ordered = this.loadDatabaseChangelogs();
        if (!ordered) return;

        // Generate in order
        ordered.forEach(item => {
            this._writeChangelog(item);
        });
    }

    _generateChangelogFromDiff(entities) {
        const { generate = false } = this.options;
        const relationshipsChangelogs = [];
        const savedChangelogs = [];
        // Compare entity changes and create changelogs
        entities.forEach(loaded => {
            const currentEntity = { ...loaded.definition };
            const entityName = currentEntity.name || loaded.name;

            let fields = [];
            let relationships = [];

            if (!generate) {
                const entity = this.loadDatabaseChangelogEntity(entityName);
                fields = entity.fields;
                relationships = entity.relationships;
            }

            const currentFields = currentEntity.fields || [];
            // Calculate new fields
            const addedFields = fields.filter(field => !currentFields.find(fieldRef => fieldRef.fieldName === field.fieldName));
            // Calculate removed fields
            const removedFields = currentFields.filter(field => !fields.find(fieldRef => fieldRef.fieldName === field.fieldName));

            // Create a new changelog of type entity-fields
            const changelog = this._createChangelogContext('entity-fields', entityName);
            if (addedFields.length) {
                changelog.set('addedFields', addedFields);
            }
            if (removedFields.length) {
                changelog.set(
                    'removedFields',
                    removedFields.map(field => field.fieldName)
                );
            }

            if (changelog.save()) {
                // Multiples changelogs can be found.
                // If persisted then run a full regeneration.
                savedChangelogs.push(changelog.getChangelog());
            }

            // Calculate new relationships
            const addedRelationships = relationships.filter(
                relationship =>
                    !currentEntity.relationships.find(relRef => {
                        const refName = relRef.relationshipName || relRef.otherEntityName;
                        const name = relationship.relationshipName || relationship.otherEntityName;
                        return refName === name;
                    })
            );
            // Calculate removed relationships
            const removedRelationships = currentEntity.relationships.filter(
                relationship =>
                    !relationships.find(relRef => {
                        const refName = relRef.relationshipName || relRef.otherEntityName;
                        const name = relationship.relationshipName || relationship.otherEntityName;
                        return refName === name;
                    })
            );

            if (addedRelationships.length || removedRelationships.length) {
                const changedRelationships = { entityName };
                if (addedRelationships.length) {
                    changedRelationships.addedRelationships = addedRelationships;
                }
                if (removedRelationships.length) {
                    changedRelationships.removedRelationships = removedRelationships.map(
                        rel => `${rel.relationshipName}:${rel.relationshipType}`
                    );
                }
                // Delay the relationship generation so every new entity is set.
                relationshipsChangelogs.push(changedRelationships);
            }
        });

        // Create relationships changelogs
        relationshipsChangelogs.forEach(changelog => {
            const relationshipChangelog = this._createChangelogContext('entity-relationships', changelog.entityName);
            if (changelog.addedRelationships) {
                relationshipChangelog.set('addedRelationships', changelog.addedRelationships);
            }
            if (changelog.removedRelationships) {
                relationshipChangelog.set('removedRelationships', changelog.removedRelationships);
            }

            if (relationshipChangelog.save()) {
                savedChangelogs.push(relationshipChangelog.getChangelog());
            }
        });
        if (savedChangelogs.length && !generate) {
            // Multiples changelogs can be found.
            // If persisted then run a full regeneration.
            this.fullRegeneration = true;
        }
        return savedChangelogs;
    }
};
