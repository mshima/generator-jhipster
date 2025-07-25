/**
 * Copyright 2013-2025 the original author or authors from the JHipster project.
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

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { upperFirst } from 'lodash-es';

import type { Storage } from 'yeoman-generator';
import BaseApplicationGenerator from '../base-application/index.js';
import { JHIPSTER_CONFIG_DIR } from '../generator-constants.js';
import { reservedKeywords } from '../../lib/jhipster/index.js';
import { GENERATOR_ENTITIES } from '../generator-list.js';
import { getDBTypeFromDBValue, hibernateSnakeCase } from '../server/support/index.js';
import { APPLICATION_TYPE_GATEWAY, APPLICATION_TYPE_MICROSERVICE } from '../../lib/core/application-types.ts';
import type { Features } from '../base/types.js';
import {
  askForDTO,
  askForFields,
  askForFieldsToRemove,
  askForFiltering,
  askForMicroserviceJson,
  askForPagination,
  askForReadOnly,
  askForRelationsToRemove,
  askForRelationships,
  askForService,
  askForUpdate,
} from './prompts.js';
import type {
  Application as EntityApplication,
  Config as EntityConfig,
  Entity as EntityEntity,
  Options as EntityOptions,
} from './types.js';

const { isReservedClassName } = reservedKeywords;

export default class EntityGenerator extends BaseApplicationGenerator<
  EntityEntity,
  EntityApplication<EntityEntity>,
  EntityConfig,
  EntityOptions
> {
  name!: string;
  application: any = {};
  microserviceConfig?: any;
  entityStorage!: Storage;
  entityConfig!: EntityEntity;
  entityData!: {
    name: string;
    filename: string;
    configExisted: boolean;
    entityExisted: boolean;
    configurationFileExists: boolean;

    useMicroserviceJson?: boolean;
    skipUiGrouping?: boolean;
    useConfigurationFile?: boolean;
    microserviceName?: string;
    microserviceFileName?: string;
    microservicePath?: string;
    clientRootFolder?: string;
    databaseType?: string;
    skipClient?: boolean;
    skipServer?: boolean;
    skipDbChangelog?: boolean;
    updateEntity?: 'add' | 'remove' | 'none' | 'regenerate';
    regenerate?: boolean;
    clientFramework?: string;
    reactive?: boolean;
    enums?: string[];
    existingEnum?: boolean;
  };

  constructor(args: string | string[], options: EntityOptions, features: Features) {
    super(args, options, { unique: 'argument', ...features });
  }

  async beforeQueue() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints();
    }

    if (!this.delegateToBlueprint) {
      await this.dependsOnBootstrapApplication();
    }
  }

  // Public API method used by the getter and also by Blueprints
  get initializing() {
    return this.asInitializingTaskGroup({
      parseOptions() {
        const name = upperFirst(this.name).replace('.json', '');
        this.entityStorage = this.getEntityConfig(name, true)!;
        this.entityConfig = this.entityStorage.createProxy() as EntityEntity;

        const configExisted = this.entityStorage.existed;
        const filename = path.join(JHIPSTER_CONFIG_DIR, `${name}.json`);
        const entityExisted = fs.existsSync(this.destinationPath(filename));

        this.jhipsterConfig.entities = [...(this.jhipsterConfig.entities ?? []), name];
        this.entityData = {
          name,
          filename,
          configExisted,
          entityExisted,
          configurationFileExists: this.fs.exists(this.destinationPath(filename)),
        };

        this._setupEntityOptions();
      },

      loadOptions() {
        if (this.options.db) {
          this.entityConfig.databaseType = getDBTypeFromDBValue(this.options.db);
          if (this.entityConfig.databaseType === 'sql') {
            this.entityConfig.prodDatabaseType = this.options.db;
          }
        }

        if (this.options.skipServer !== undefined) {
          this.entityConfig.skipServer = this.options.skipServer;
        }
        if (this.options.skipDbChangelog !== undefined) {
          this.entityConfig.skipDbChangelog = this.options.skipDbChangelog;
        }
        if (this.options.skipClient !== undefined) {
          this.entityConfig.skipClient = this.options.skipClient;
        }
      },
    });
  }

  get [BaseApplicationGenerator.INITIALIZING]() {
    return this.delegateTasksToBlueprint(() => this.initializing);
  }

  get prompting() {
    return this.asPromptingTaskGroup({
      /* Use need microservice path to load the entity file */
      askForMicroserviceJson,
    });
  }

  get [BaseApplicationGenerator.PROMPTING]() {
    return this.delegateTasksToBlueprint(() => this.prompting);
  }

  get postPreparing() {
    return this.asPostPreparingTaskGroup({
      isBuiltInEntity({ application }) {
        if (
          (application.generateBuiltInUserEntity && this.entityData.name.toLowerCase() === 'user)') ||
          (application.generateBuiltInAuthorityEntity && this.entityData.name.toLowerCase() === 'authority')
        ) {
          throw new Error(`Is not possible to override built in ${this.entityData.name}`);
        }
      },

      setupMicroServiceEntity({ application }) {
        const context = this.entityData;

        if (application.applicationType === APPLICATION_TYPE_MICROSERVICE) {
          context.microserviceName = this.entityConfig.microserviceName = this.jhipsterConfig.baseName!;
          if (!this.entityConfig.clientRootFolder) {
            context.clientRootFolder = this.entityConfig.clientRootFolder = this.entityConfig.microserviceName;
          }
        } else if (application.applicationType === APPLICATION_TYPE_GATEWAY) {
          // If microservicePath is set we are loading the entity from the microservice side.
          context.useMicroserviceJson = !!this.entityConfig.microservicePath;
          if (context.useMicroserviceJson) {
            context.microserviceFileName = this.destinationPath(this.entityConfig.microservicePath!, context.filename);
            context.useConfigurationFile = true;

            this.log.verboseInfo(`
The entity ${context.name} is being updated.
`);
            try {
              // We are generating a entity from a microservice.
              // Load it directly into our entity configuration.
              this.microserviceConfig = this.fs.readJSON(context.microserviceFileName);
              if (this.microserviceConfig) {
                this.entityStorage.set(this.microserviceConfig);
              }
            } catch (err) {
              this.log.debug('Error:', err);
              throw new Error(`The entity configuration file could not be read! ${err}`, { cause: err });
            }
          }
          if (this.entityConfig.clientRootFolder === undefined) {
            context.clientRootFolder = this.entityConfig.clientRootFolder = context.skipUiGrouping
              ? ''
              : this.entityConfig.microserviceName;
          }
        }
      },

      loadEntitySpecificOptions({ application }) {
        this.entityData.skipClient = this.entityData.skipClient || this.entityConfig.skipClient;
        this.entityData.databaseType = this.entityData.databaseType || this.entityConfig.databaseType || application.databaseType;
      },

      validateEntityName() {
        const validation = this._validateEntityName(this.entityData.name);
        if (validation !== true) {
          throw new Error(validation);
        }
      },

      bootstrapConfig({ application }) {
        const context = this.entityData;
        const entityName = context.name;
        if ([APPLICATION_TYPE_MICROSERVICE, APPLICATION_TYPE_GATEWAY].includes(application.applicationType!)) {
          if (this.entityConfig.databaseType === undefined) {
            this.entityConfig.databaseType = context.databaseType!;
          }
        }
        context.useConfigurationFile = context.configurationFileExists || context.useConfigurationFile;
        if (context.configurationFileExists) {
          this.log.log(
            chalk.green(`
Found the ${context.filename} configuration file, entity can be automatically generated!
`),
          );
        }

        // Structure for prompts.
        this.entityStorage.defaults({ fields: [], relationships: [] });

        if (!context.useConfigurationFile) {
          this.log.verboseInfo(`
The entity ${entityName} is being created.
`);
        }
      },
      /* ask question to user if s/he wants to update entity */
      askForUpdate,
      askForFields,
      askForFieldsToRemove,
      askForRelationships,
      askForRelationsToRemove,
      askForService,
      askForDTO,
      askForFiltering,
      askForReadOnly,
      askForPagination,
      async composeEntities() {
        // We need to compose with others entities to update relationships.
        await this.composeWithJHipster(GENERATOR_ENTITIES, {
          generatorArgs: this.options.singleEntity ? [this.entityData.name] : [],
        });
      },
    });
  }

  get [BaseApplicationGenerator.POST_PREPARING]() {
    return this.delegateTasksToBlueprint(() => this.postPreparing);
  }

  // Public API method used by the getter and also by Blueprints
  get end() {
    return this.asEndTaskGroup({
      end() {
        this.log.log(chalk.bold.green(`Entity ${this.entityData.name} generated successfully.`));
      },
    });
  }

  get [BaseApplicationGenerator.END]() {
    return this.delegateTasksToBlueprint(() => this.end);
  }

  /**
   * @private
   * Setup Entity instance level options from context.
   * all variables should be set to dest,
   * all variables should be referred from context,
   * all methods should be called on generator,
   * @param {any} generator - generator instance
   * @param {any} context - context to use default is generator instance
   * @param {any} dest - destination context to use default is context
   */
  _setupEntityOptions() {
    this.entityData.regenerate = this.options.regenerate;

    if (this.options.skipCheckLengthOfIdentifier !== undefined) {
      this.entityConfig.skipCheckLengthOfIdentifier = this.options.skipCheckLengthOfIdentifier;
    }
    if (this.options.angularSuffix !== undefined) {
      this.entityConfig.angularJSSuffix = this.options.angularSuffix;
    }
    if (this.options.skipUiGrouping !== undefined) {
      this.entityConfig.skipUiGrouping = this.options.skipUiGrouping;
    }
    if (this.options.clientRootFolder !== undefined) {
      if (this.entityConfig.skipUiGrouping) {
        this.log.warn('Ignoring client-root-folder due to skip-ui-grouping configuration');
      } else {
        this.entityConfig.clientRootFolder = this.options.clientRootFolder;
      }
    }
    if (this.options.skipClient !== undefined) {
      this.entityConfig.skipClient = this.options.skipClient;
    }
    if (this.options.skipServer !== undefined) {
      this.entityConfig.skipServer = this.options.skipServer;
    }

    if (this.options.tableName) {
      this.entityConfig.entityTableName = hibernateSnakeCase(this.options.tableName);
    }
  }

  /**
   * @private
   * Validate the entityName
   * @return {true|string} true for a valid value or error message.
   */
  _validateEntityName(entityName: string): true | string {
    if (!/^([a-zA-Z0-9]*)$/.test(entityName)) {
      return 'The entity name must be alphanumeric only';
    }
    if (/^[0-9].*$/.test(entityName)) {
      return 'The entity name cannot start with a number';
    }
    if (entityName === '') {
      return 'The entity name cannot be empty';
    }
    if (entityName.indexOf('Detail', entityName.length - 'Detail'.length) !== -1) {
      return "The entity name cannot end with 'Detail'";
    }
    if (!this.entityData.skipServer && isReservedClassName(entityName)) {
      return 'The entity name cannot contain a Java or JHipster reserved keyword';
    }
    return true;
  }
}
