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
/* eslint-disable consistent-return */
const chalk = require('chalk');
const _ = require('lodash');
const BaseBlueprintGenerator = require('../generator-base-blueprint');
const cleanup = require('../cleanup');
const prompts = require('./prompts');
const packagejs = require('../../package.json');
const statistics = require('../statistics');
const jhipsterUtils = require('../utils');
const { appDefaultConfig, defaultConfig } = require('../generator-defaults');

let useBlueprints;

module.exports = class extends BaseBlueprintGenerator {
    constructor(args, opts) {
        super(args, opts);

        // This adds support for a `--from-cli` flag
        this.option('from-cli', {
            desc: 'Indicates the command is run from JHipster CLI',
            type: Boolean,
            defaults: false,
            hide: true,
        });
        this.option('defaults', {
            desc: 'Execute jhipster with default config',
            type: Boolean,
            defaults: false,
        });
        // This adds support for a `--skip-client` flag
        this.option('skip-client', {
            desc: 'Skip the client-side application generation',
            type: Boolean,
            defaults: defaultConfig.skipClient,
        });

        // This adds support for a `--skip-server` flag
        this.option('skip-server', {
            desc: 'Skip the server-side application generation',
            type: Boolean,
            defaults: defaultConfig.skipServer,
        });

        // This adds support for a `--skip-git` flag
        this.option('skip-git', {
            desc: 'Skip the git initialization',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--skip-commit-hook` flag
        this.option('skip-commit-hook', {
            desc: 'Skip adding husky commit hooks',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--skip-user-management` flag
        this.option('skip-user-management', {
            desc: 'Skip the user management module during app generation',
            type: Boolean,
            defaults: defaultConfig.skipUserManagement,
        });

        // This adds support for a `--skip-check-length-of-identifier` flag
        this.option('skip-check-length-of-identifier', {
            desc: 'Skip check the length of the identifier, only for recent Oracle databases that support 30+ characters metadata',
            type: Boolean,
            defaults: defaultConfig.skipCheckLengthOfIdentifier,
        });

        // This adds support for a `--skip-fake-data` flag
        this.option('skip-fake-data', {
            desc: 'Skip generation of fake data for development',
            type: Boolean,
            defaults: defaultConfig.skipFakeData,
        });

        // This adds support for a `--with-entities` flag
        this.option('with-entities', {
            desc: 'Regenerate the existing entities if any',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--skip-checks` flag
        this.option('skip-checks', {
            desc: 'Check the status of the required tools',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--jhi-prefix` flag
        this.option('jhi-prefix', {
            desc: 'Add prefix before services, controllers and states name',
            type: String,
        });

        // This adds support for a `--entity-suffix` flag
        this.option('entity-suffix', {
            desc: 'Add suffix after entities name',
            type: String,
        });

        // This adds support for a `--dto-suffix` flag
        this.option('dto-suffix', {
            desc: 'Add suffix after dtos name',
            type: String,
        });

        // This adds support for a `--yarn` flag
        this.option('yarn', {
            desc: 'Use yarn instead of npm',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--auth` flag
        this.option('auth', {
            desc: 'Provide authentication type for the application when skipping server side generation',
            type: String,
        });

        // This adds support for a `--db` flag
        this.option('db', {
            desc: 'Provide DB name for the application when skipping server side generation',
            type: String,
        });

        // This adds support for a `--uaa-base-name` flag
        this.option('uaa-base-name', {
            desc: 'Provide the name of UAA server, when using --auth uaa and skipping server side generation',
            type: String,
        });

        // This adds support for a `--build` flag
        this.option('build', {
            desc: 'Provide build tool for the application when skipping server side generation',
            type: String,
        });

        // This adds support for a `--websocket` flag
        this.option('websocket', {
            desc: 'Provide websocket option for the application when skipping server side generation',
            type: String,
        });

        // This adds support for a `--search-engine` flag
        this.option('search-engine', {
            desc: 'Provide search engine for the application when skipping server side generation',
            type: String,
        });

        // NOTE: Deprecated!!! Use --blueprints instead
        this.option('blueprint', {
            desc: 'DEPRECATED: Specify a generator blueprint to use for the sub generators',
            type: String,
        });
        // This adds support for a `--blueprints` flag which can be used to specify one or more blueprints to use for generation
        this.option('blueprints', {
            desc:
                'A comma separated list of one or more generator blueprints to use for the sub generators, e.g. --blueprints kotlin,vuejs',
            type: String,
        });

        // This adds support for a `--experimental` flag which can be used to enable experimental features
        this.option('experimental', {
            desc:
                'Enable experimental features. Please note that these features may be unstable and may undergo breaking changes at any time',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--creation-timestamp` flag which can be used create reproducible builds
        this.option('creation-timestamp', {
            desc: 'Project creation timestamp (used for reproducible builds)',
            type: String,
        });

        // This adds support for a `--prettier-java` flag
        this.option('prettier-java', {
            desc: 'Launch prettier-java pre-formatting at generation',
            type: Boolean,
            defaults: false,
        });

        // Just constructing help, stop here
        if (this.options.help) {
            return;
        }

        // Load runtime only options
        this.withEntities = this.configOptions.withEntities = this.options.withEntities;
        this.skipChecks = this.configOptions.skipChecks = this.options.skipChecks;
        this.isDebugEnabled = this.configOptions.isDebugEnabled = this.options.debug;
        this.experimental = this.configOptions.experimental = this.options.experimental;

        // Load stored options
        if (this.options.skipClient) {
            this.skipClient = this.jhipsterConfig.skipClient = true;
        }
        if (this.options.skipServer) {
            this.skipServer = this.jhipsterConfig.skipServer = true;
        }
        if (this.options.skipFakeData) {
            this.jhipsterConfig.skipFakeData = true;
        }
        if (this.options.skipUserManagement) {
            this.jhipsterConfig.skipUserManagement = true;
        }
        if (this.options.skipCheckLengthOfIdentifier) {
            this.jhipsterConfig.skipCheckLengthOfIdentifier = true;
        }
        if (this.options.prettierJava) {
            this.jhipsterConfig.prettierJava = true;
        }
        if (this.options.skipCommitHook) {
            this.jhipsterConfig.skipCommitHook = true;
        }

        if (this.options.db) {
            this.jhipsterConfig.databaseType = this.getDBTypeFromDBValue(this.options.db);
            this.jhipsterConfig.devDatabaseType = this.options.db;
            this.jhipsterConfig.prodDatabaseType = this.options.db;
        }
        if (this.options.auth) {
            this.jhipsterConfig.authenticationType = this.options.auth;
        }
        if (this.options.uaaBaseName) {
            this.jhipsterConfig.uaaBaseName = this.options.uaaBaseName;
        }
        if (this.options.searchEngine) {
            this.jhipsterConfig.searchEngine = this.options.searchEngine;
        }
        if (this.options.build) {
            this.jhipsterConfig.buildTool = this.options.build;
        }
        if (this.options.websocket) {
            this.jhipsterConfig.websocket = this.options.websocket;
        }
        if (this.options.jhiPrefix) {
            this.jhipsterConfig.jhiPrefix = this.options.jhiPrefix;
        }
        if (this.options.entitySuffix) {
            this.jhipsterConfig.entitySuffix = this.options.entitySuffix;
        }
        if (this.options.dtoSuffix) {
            this.jhipsterConfig.dtoSuffix = this.options.dtoSuffix;
        }
        this.useYarn = this.configOptions.useYarn = this.options.yarn || this.jhipsterConfig.clientPackageManager === 'yarn';
        this.useNpm = this.configOptions.useNpm = !this.options.yarn;
        this.jhipsterConfig.clientPackageManager = this.useYarn ? 'yarn' : 'npm';

        if (this.options.creationTimestamp) {
            const creationTimestamp = this.parseCreationTimestamp();
            if (creationTimestamp) {
                this.jhipsterConfig.creationTimestamp = creationTimestamp;
            }
        }

        // Use jhipster defaults
        if (this.options.defaults) {
            this.setConfigDefaults();
        }

        this.existingProject = this.jhipsterConfig.baseName !== undefined && this.jhipsterConfig.applicationType !== undefined;
        // preserve old jhipsterVersion value for cleanup which occurs after new config is written into disk
        this.jhipsterOldVersion = this.jhipsterConfig.jhipsterVersion;

        let blueprints = this.options.blueprints || '';
        // check for old single blueprint declaration
        const blueprint = this.options.blueprint;
        if (blueprint) {
            this.warning('--blueprint option is deprecated. Please use --blueprints instead');
            if (!blueprints.split(',').includes(blueprint)) {
                blueprints = `${blueprint},${blueprints}`;
            }
        }
        if (blueprints) {
            blueprints = jhipsterUtils.parseBluePrints(blueprints);
        } else {
            blueprints = jhipsterUtils.loadBlueprintsFromConfiguration(this.config);
        }

        this.blueprints = this.configOptions.blueprints = blueprints;

        useBlueprints = !this.fromBlueprint && this.instantiateBlueprints('app');

        this.registerPrettierTransform();
    }

    _initializing() {
        return {
            validateFromCli() {
                this.checkInvocationFromCLI();
            },

            displayLogo() {
                this.printJHipsterLogo();
            },

            validateBlueprint() {
                if (this.blueprints && !this.skipChecks) {
                    this.blueprints.forEach(blueprint => {
                        this.checkJHipsterBlueprintVersion(blueprint.name);
                        this.checkBlueprint(blueprint.name);
                    });
                }
            },

            validateJava() {
                this.checkJava();
            },

            validateNode() {
                this.checkNode();
            },

            validateGit() {
                this.checkGit();
            },

            validateYarn() {
                this.checkYarn();
            },

            checkForNewJHVersion() {
                if (!this.skipChecks) {
                    this.checkForNewVersion();
                }
            },

            validate() {
                if (this.skipServer && this.skipClient) {
                    this.error(`You can not pass both ${chalk.yellow('--skip-client')} and ${chalk.yellow('--skip-server')} together`);
                }
            },
        };
    }

    get initializing() {
        if (useBlueprints) {
            return;
        }
        return this._initializing();
    }

    _prompting() {
        return {
            askForInsightOptIn: prompts.askForInsightOptIn,
            askForApplicationType: prompts.askForApplicationType,
            askForModuleName: prompts.askForModuleName,
        };
    }

    get prompting() {
        if (useBlueprints) return;
        return this._prompting();
    }

    _configuring() {
        return {
            setup() {
                // Update jhipsterVersion.
                this.jhipsterConfig.jhipsterVersion = packagejs.version;
                this.jhipsterConfig.creationTimestamp = this.parseCreationTimestamp() || this.config.get('') || new Date().getTime();

                this.otherModules = this.config.get('otherModules') || [];
                if (this.blueprints && this.blueprints.length > 0) {
                    this.blueprints.forEach(blueprint => {
                        blueprint.version = this.findBlueprintVersion(blueprint.name) || blueprint.version || 'latest';
                    });

                    // Remove potential previous value to avoid duplicates
                    this.otherModules = this.otherModules.filter(module => this.blueprints.findIndex(bp => bp.name === module.name) === -1);
                    this.otherModules.push(...this.blueprints);
                }
                this.jhipsterConfig.otherModules = this.otherModules;

                this.configOptions.skipI18nQuestion = true;
                this.configOptions.logo = false;
                this.generatorType = 'app';
                if (this.jhipsterConfig.applicationType === 'microservice') {
                    this.jhipsterConfig.skipClient = true;
                    this.generatorType = 'server';
                    this.jhipsterConfig.skipUserManagement = true;
                }
                if (this.jhipsterConfig.applicationType === 'uaa') {
                    this.jhipsterConfig.skipClient = true;
                    this.generatorType = 'server';
                    this.jhipsterConfig.skipUserManagement = false;
                    this.jhipsterConfig.authenticationType = 'uaa';
                }
                if (this.skipClient) {
                    // defaults to use when skipping client
                    this.generatorType = 'server';
                }
                if (this.skipServer) {
                    // defaults to use when skipping server
                    this.generatorType = 'client';
                }

                // Set app defaults
                this.setConfigDefaults(appDefaultConfig);
            },

            composeServer() {
                if (this.skipServer || this.configOptions.skipComposeServer) return;
                this.configOptions.skipComposeServer = true;
                const options = this.options;
                const configOptions = this.configOptions;

                this.composeWith(require.resolve('../server'), {
                    ...options,
                    configOptions,
                    'client-hook': !this.skipClient,
                    debug: this.isDebugEnabled,
                });
            },

            composeClient() {
                if (this.skipClient || this.configOptions.skipComposeClient) return;
                this.configOptions.skipComposeClient = true;
                const options = this.options;
                const configOptions = this.configOptions;

                this.composeWith(require.resolve('../client'), {
                    ...options,
                    configOptions,
                    debug: this.isDebugEnabled,
                });
            },

            composeCommon() {
                if (this.configOptions.skipComposeCommon) return;
                this.configOptions.skipComposeCommon = true;
                const options = this.options;
                const configOptions = this.configOptions;

                this.composeWith(require.resolve('../common'), {
                    ...options,
                    'client-hook': !this.skipClient,
                    configOptions,
                    debug: this.isDebugEnabled,
                });
            },

            askFori18n: prompts.askForI18n,
        };
    }

    get configuring() {
        if (useBlueprints) return;
        return this._configuring();
    }

    _default() {
        return {
            askForTestOpts: prompts.askForTestOpts,

            askForMoreModules: prompts.askForMoreModules,

            composeLanguages() {
                if (this.skipI18n || this.configOptions.skipComposeLanguages) return;
                this.configOptions.skipComposeLanguages = true;
                this.composeLanguagesSub(this, this.configOptions, this.generatorType);
            },

            saveConfig() {
                this.setConfigDefaults();

                const config = {};
                this.blueprints && (config.blueprints = this.blueprints);
                this.blueprintVersion && (config.blueprintVersion = this.blueprintVersion);
                this.config.set(config);

                this.validateConfiguration();
            },

            insight() {
                const yorc = {
                    ..._.omit(this.jhipsterConfig, [
                        'jhiPrefix',
                        'baseName',
                        'jwtSecretKey',
                        'packageName',
                        'packagefolder',
                        'rememberMeKey',
                    ]),
                };
                yorc.applicationType = this.jhipsterConfig.applicationType;
                statistics.sendYoRc(yorc, this.existingProject, this.jhipsterConfig.jhipsterVersion);
            },
        };
    }

    get default() {
        if (useBlueprints) return;
        return this._default();
    }

    _writing() {
        return {
            cleanup() {
                cleanup.cleanupOldFiles(this);
                cleanup.upgradeFiles(this);
            },

            regenerateEntities() {
                if (this.withEntities && !this.configOptions.skipComposeEntity) {
                    this.configOptions.skipComposeEntity = true;
                    const options = this.options;
                    const configOptions = this.configOptions;
                    this.getExistingEntities().forEach(entity => {
                        this.composeWith(require.resolve('../entity'), {
                            ...options,
                            configOptions,
                            regenerate: true,
                            'skip-install': true,
                            debug: this.isDebugEnabled,
                            arguments: [entity.name],
                        });
                    });
                }
            },

            initGitRepo() {
                if (!this.options['skip-git']) {
                    if (this.gitInstalled || this.isGitInstalled()) {
                        const gitDir = this.gitExec('rev-parse --is-inside-work-tree', { trace: false }).stdout;
                        // gitDir has a line break to remove (at least on windows)
                        if (gitDir && gitDir.trim() === 'true') {
                            this.gitInitialized = true;
                        } else {
                            const shellStr = this.gitExec('init', { trace: false });
                            this.gitInitialized = shellStr.code === 0;
                            if (this.gitInitialized) this.log(chalk.green.bold('Git repository initialized.'));
                            else this.warning(`Failed to initialize Git repository.\n ${shellStr.stderr}`);
                        }
                    } else {
                        this.warning('Git repository could not be initialized, as Git is not installed on your system');
                    }
                }
            },
        };
    }

    get writing() {
        if (useBlueprints) return;
        return this._writing();
    }

    _end() {
        return {
            gitCommit() {
                if (!this.options['skip-git'] && this.isGitInstalled()) {
                    if (this.gitInitialized) {
                        this.debug('Committing files to git');
                        const done = this.async();
                        this.gitExec('log --oneline -n 1 -- .', { trace: false }, (code, commits) => {
                            if (code !== 0 || !commits || !commits.trim()) {
                                // if no files in Git from current folder then we assume that this is initial application generation
                                this.gitExec('add .', { trace: false }, code => {
                                    if (code === 0) {
                                        let commitMsg = `Initial version of ${this.baseName} generated by JHipster-${this.jhipsterVersion}`;
                                        if (this.blueprints && this.blueprints.length > 0) {
                                            const bpInfo = this.blueprints
                                                .map(bp => `${bp.name.replace('generator-jhipster-', '')}-${bp.version}`)
                                                .join(', ');
                                            commitMsg += ` with blueprints: ${bpInfo}`;
                                        }
                                        this.gitExec(`commit -m "${commitMsg}" -- .`, { trace: false }, code => {
                                            if (code === 0) {
                                                this.log(
                                                    chalk.green.bold(`Application successfully committed to Git from ${process.cwd()}.`)
                                                );
                                            } else {
                                                this.log(
                                                    chalk.red.bold(
                                                        `Application commit to Git failed from ${process.cwd()}. Try to commit manually.`
                                                    )
                                                );
                                            }
                                            done();
                                        });
                                    } else {
                                        this.warning(
                                            `The generated application could not be committed to Git, because ${chalk.bold(
                                                'git add'
                                            )} command failed.`
                                        );
                                        done();
                                    }
                                });
                            } else {
                                // if found files in Git from current folder then we assume that this is application regeneration
                                // if there are changes in current folder then inform user about manual commit needed
                                this.gitExec('diff --name-only .', { trace: false }, (code, diffs) => {
                                    if (code === 0 && diffs && diffs.trim()) {
                                        this.log(
                                            `Found commits in Git from ${process.cwd()}. So we assume this is application regeneration. Therefore automatic Git commit is not done. You can do Git commit manually.`
                                        );
                                    }
                                    done();
                                });
                            }
                        });
                    } else {
                        this.warning(
                            'The generated application could not be committed to Git, as a Git repository could not be initialized.'
                        );
                    }
                }
            },

            afterRunHook() {
                try {
                    const modules = this.getModuleHooks();
                    if (modules.length > 0) {
                        this.log(`\n${chalk.bold.green('Running post run module hooks\n')}`);
                        // run through all post app creation module hooks
                        this.callHooks('app', 'post', {
                            appConfig: this.configOptions,
                            force: this.options.force,
                        });
                    }
                } catch (err) {
                    this.log(`\n${chalk.bold.red('Running post run module hooks failed. No modification done to the generated app.')}`);
                    this.debug('Error:', err);
                }
                this.log(
                    chalk.green(
                        `\nIf you find JHipster useful consider sponsoring the project ${chalk.yellow(
                            'https://www.jhipster.tech/sponsors/'
                        )}`
                    )
                );
            },
        };
    }

    get end() {
        if (useBlueprints) return;
        return this._end();
    }
};
