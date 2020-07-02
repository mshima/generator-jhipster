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
const prompts = require('./prompts');
const writeAngularFiles = require('./files-angular').writeFiles;
const writeReactFiles = require('./files-react').writeFiles;
const packagejs = require('../../package.json');
const constants = require('../generator-constants');
const statistics = require('../statistics');
const { clientDefaultConfig } = require('../generator-defaults');

const ANGULAR = constants.SUPPORTED_CLIENT_FRAMEWORKS.ANGULAR;
const REACT = constants.SUPPORTED_CLIENT_FRAMEWORKS.REACT;

let useBlueprints;

module.exports = class extends BaseBlueprintGenerator {
    constructor(args, opts) {
        super(args, opts);

        // This adds support for a `--from-cli` flag
        this.option('from-cli', {
            desc: 'Indicates the command is run from JHipster CLI',
            type: Boolean,
            defaults: false,
        });
        // This adds support for a `--auth` flag
        this.option('auth', {
            desc: 'Provide authentication type for the application',
            type: String,
        });

        // This adds support for a `--skip-commit-hook` flag
        this.option('skip-commit-hook', {
            desc: 'Skip adding husky commit hooks',
            type: Boolean,
            defaults: false,
        });

        // This adds support for a `--experimental` flag which can be used to enable experimental features
        this.option('experimental', {
            desc:
                'Enable experimental features. Please note that these features may be unstable and may undergo breaking changes at any time',
            type: Boolean,
            defaults: false,
        });

        if (this.options.help) {
            return;
        }

        this.experimental = this.configOptions.experimental = this.options.experimental;

        if (this.options.auth) {
            this.jhipsterConfig.authenticationType = this.options.auth;
        }
        if (this.options.skipCommitHook) {
            this.skipCommitHook = this.jhipsterConfig.skipCommitHook = true;
        }

        this.existingProject = !!this.jhipsterConfig.clientFramework;

        useBlueprints = !this.fromBlueprint && this.instantiateBlueprints('client');
    }

    // Public API method used by the getter and also by Blueprints
    _initializing() {
        return {
            validateFromCli() {
                this.checkInvocationFromCLI();
            },

            displayLogo() {
                if (this.logo) {
                    this.printJHipsterLogo();
                }
            },

            setupClientconsts() {
                // Make constants available in templates
                this.LOGIN_REGEX = constants.LOGIN_REGEX_JS;
                this.ANGULAR = ANGULAR;
                this.HUSKY_VERSION = constants.HUSKY_VERSION;
                this.LINT_STAGED_VERSION = constants.LINT_STAGED_VERSION;
                this.PRETTIER_VERSION = constants.PRETTIER_VERSION;
                this.PRETTIER_JAVA_VERSION = constants.PRETTIER_JAVA_VERSION;
                this.NODE_VERSION = constants.NODE_VERSION;
            },
        };
    }

    get initializing() {
        if (useBlueprints) return;
        return this._initializing();
    }

    // Public API method used by the getter and also by Blueprints
    _prompting() {
        return {
            askForModuleName: prompts.askForModuleName,
            askForClient: prompts.askForClient,
            askFori18n: prompts.askForI18n,
            askForClientTheme: prompts.askForClientTheme,
            askForClientThemeVariant: prompts.askForClientThemeVariant,
        };
    }

    get prompting() {
        if (useBlueprints) return;
        return this._prompting();
    }

    // Public API method used by the getter and also by Blueprints
    _configuring() {
        return {
            configureGlobal() {
                // Make constants available in templates
                this.MAIN_SRC_DIR = this.CLIENT_MAIN_SRC_DIR;
                this.TEST_SRC_DIR = this.CLIENT_TEST_SRC_DIR;
            },

            saveConfig() {
                this.setConfigDefaults(clientDefaultConfig);
            },
        };
    }

    get configuring() {
        if (useBlueprints) return;
        return this._configuring();
    }

    // Public API method used by the getter and also by Blueprints
    _default() {
        return {
            composeLanguages() {
                if (this.configOptions.skipI18nQuestion) return;

                this.composeLanguagesSub(this, this.configOptions, 'client');
            },

            validateSkipServer() {
                if (
                    this.jhipsterConfig.skipServer &&
                    !(
                        this.jhipsterConfig.databaseType &&
                        this.jhipsterConfig.devDatabaseType &&
                        this.jhipsterConfig.prodDatabaseType &&
                        this.jhipsterConfig.authenticationType
                    )
                ) {
                    this.error(
                        `When using skip-server flag, you must pass a database option and authentication type using ${chalk.yellow(
                            '--db'
                        )} and ${chalk.yellow('--auth')} flags`
                    );
                }
                if (
                    this.jhipsterConfig.skipServer &&
                    this.jhipsterConfig.authenticationType === 'uaa' &&
                    !this.jhipsterConfig.uaaBaseName
                ) {
                    this.error(
                        `When using skip-server flag and UAA as authentication method, you must pass a UAA base name using ${chalk.yellow(
                            '--uaa-base-name'
                        )} flag`
                    );
                }
            },
            getSharedConfigOptions() {
                this.serverPort = this.jhipsterConfig.serverPort || 8080;

                this.setupClientOptions(this);

                this.clientFramework = this.jhipsterConfig.clientFramework;
                this.clientTheme = this.jhipsterConfig.clientTheme || 'none';
                this.clientThemeVariant = this.jhipsterConfig.clientThemeVariant;
                this.enableI18nRTL = false;

                this.packagejs = packagejs;

                this.baseName = this.jhipsterConfig.baseName;
                this.clientPackageManager = this.jhipsterConfig.clientPackageManager;
                this.applicationType = this.jhipsterConfig.applicationType;
                this.reactive = this.jhipsterConfig.reactive;
                this.messageBroker = this.jhipsterConfig.messageBroker;
                this.serviceDiscoveryType = this.jhipsterConfig.serviceDiscoveryType;

                if (this.jhipsterConfig.cacheProvider) {
                    this.cacheProvider = this.jhipsterConfig.cacheProvider;
                }
                if (this.jhipsterConfig.enableHibernateCache) {
                    this.enableHibernateCache = this.jhipsterConfig.enableHibernateCache;
                }
                if (this.jhipsterConfig.websocket !== undefined) {
                    this.websocket = this.jhipsterConfig.websocket;
                }
                if (this.jhipsterConfig.databaseType) {
                    this.databaseType = this.jhipsterConfig.databaseType;
                }
                if (this.jhipsterConfig.devDatabaseType) {
                    this.devDatabaseType = this.jhipsterConfig.devDatabaseType;
                }
                if (this.jhipsterConfig.prodDatabaseType) {
                    this.prodDatabaseType = this.jhipsterConfig.prodDatabaseType;
                }
                if (this.jhipsterConfig.messageBroker !== undefined) {
                    this.messageBroker = this.jhipsterConfig.messageBroker;
                }
                if (this.jhipsterConfig.searchEngine !== undefined) {
                    this.searchEngine = this.jhipsterConfig.searchEngine;
                }
                if (this.jhipsterConfig.buildTool) {
                    this.buildTool = this.jhipsterConfig.buildTool;
                }
                if (this.jhipsterConfig.authenticationType) {
                    this.authenticationType = this.jhipsterConfig.authenticationType;
                }
                if (this.jhipsterConfig.otherModules) {
                    this.otherModules = this.jhipsterConfig.otherModules;
                }
                if (this.jhipsterConfig.testFrameworks) {
                    this.testFrameworks = this.jhipsterConfig.testFrameworks;
                }
                this.protractorTests = this.testFrameworks.includes('protractor');

                if (this.jhipsterConfig.enableTranslation !== undefined) {
                    this.enableTranslation = this.jhipsterConfig.enableTranslation;
                }
                if (this.jhipsterConfig.nativeLanguage !== undefined) {
                    this.nativeLanguage = this.jhipsterConfig.nativeLanguage;
                }
                if (this.jhipsterConfig.languages !== undefined) {
                    this.languages = this.jhipsterConfig.languages;
                    this.enableI18nRTL = this.isI18nRTLSupportNecessary(this.languages);
                }

                if (this.jhipsterConfig.uaaBaseName !== undefined) {
                    this.uaaBaseName = this.jhipsterConfig.uaaBaseName;
                }

                // Make dist dir available in templates
                this.BUILD_DIR = this.getBuildDirectoryForBuildTool(this.jhipsterConfig.buildTool);

                this.styleSheetExt = 'scss';
                this.pkType = this.getPkType(this.databaseType);
                this.apiUaaPath = `${this.authenticationType === 'uaa' ? `services/${this.uaaBaseName.toLowerCase()}/` : ''}`;
                this.DIST_DIR = this.getResourceBuildDirectoryForBuildTool(this.jhipsterConfig.buildTool) + constants.CLIENT_DIST_DIR;

                // Application name modified, using each technology's conventions
                this.camelizedBaseName = _.camelCase(this.baseName);
                this.angularAppName = this.getAngularAppName();
                this.angularXAppName = this.getAngularXAppName();
                this.hipster = this.getHipster(this.baseName);
                this.capitalizedBaseName = _.upperFirst(this.baseName);
                this.dasherizedBaseName = _.kebabCase(this.baseName);
                this.lowercaseBaseName = this.baseName.toLowerCase();
            },

            insight() {
                const app = { clientFramework: this.clientFramework, enableTranslation: this.enableTranslation };
                if (this.nativeLanguage !== undefined) {
                    app.nativeLanguage = this.nativeLanguage;
                }
                if (this.languages !== undefined) {
                    app.languages = this.languages;
                }
                statistics.sendSubGenEvent('generator', 'client', { app });
            },
        };
    }

    get default() {
        if (useBlueprints) return;
        return this._default();
    }

    // Public API method used by the getter and also by Blueprints
    _writing() {
        return {
            write() {
                if (this.skipClient) return;
                if (this.clientFramework === REACT) {
                    return writeReactFiles.call(this, useBlueprints);
                }
                if (this.clientFramework === ANGULAR) {
                    return writeAngularFiles.call(this, useBlueprints);
                }
            },
        };
    }

    get writing() {
        if (useBlueprints) return;
        return this._writing();
    }

    // Public API method used by the getter and also by Blueprints
    _install() {
        return {
            installing() {
                if (this.skipClient) return;
                const logMsg = `To install your dependencies manually, run: ${chalk.yellow.bold(`${this.clientPackageManager} install`)}`;

                const installConfig = {
                    bower: false,
                    npm: this.clientPackageManager !== 'yarn',
                    yarn: this.clientPackageManager === 'yarn',
                };

                if (this.options['skip-install']) {
                    this.log(logMsg);
                } else {
                    try {
                        this.installDependencies(installConfig);
                    } catch (e) {
                        this.warning('Install of dependencies failed!');
                        this.log(logMsg);
                    }
                }
            },
        };
    }

    get install() {
        if (useBlueprints) return;
        return this._install();
    }

    // Public API method used by the getter and also by Blueprints
    _end() {
        return {
            end() {
                if (this.skipClient) return;
                this.log(chalk.green.bold('\nClient application generated successfully.\n'));

                const logMsg = `Start your Webpack development server with:\n ${chalk.yellow.bold(`${this.clientPackageManager} start`)}\n`;

                this.log(chalk.green(logMsg));
                if (!this.options['skip-install']) {
                    this.spawnCommandSync(this.clientPackageManager, ['run', 'cleanup']);
                }
            },
        };
    }

    get end() {
        if (useBlueprints) return;
        return this._end();
    }
};
