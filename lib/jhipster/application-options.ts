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

import type {
  JDLApplicationConfig,
  JDLApplicationOptionType,
  JDLApplicationOptionTypeValue,
  JDLApplicationOptionValue,
} from '../jdl/core/types/parsing.js';
import { APPLICATION_TYPE_GATEWAY, APPLICATION_TYPE_MICROSERVICE, APPLICATION_TYPE_MONOLITH } from '../core/application-types.ts';
import authenticationTypes from './authentication-types.js';
import databaseTypes from './database-types.js';
import cacheTypes from './cache-types.js';
import serviceDiscoveryTypes from './service-discovery-types.js';
import clientFrameworkTypes from './client-framework-types.js';
import buildToolTypes from './build-tool-types.js';
import searchEngineTypes from './search-engine-types.js';
import testFrameworkTypes from './test-framework-types.js';
import websocketTypes from './websocket-types.js';
import { builtInConfigPropsValidations } from './jdl-validator-definition.js';

const { CASSANDRA, COUCHBASE, MARIADB, MONGODB, MSSQL, MYSQL, NEO4J, ORACLE, POSTGRESQL, SQL, H2_DISK, H2_MEMORY } = databaseTypes;

const NO_DATABASE = databaseTypes.NO;
const { JWT, OAUTH2, SESSION } = authenticationTypes;
const { MAVEN, GRADLE } = buildToolTypes;
const { CAFFEINE, EHCACHE, HAZELCAST, INFINISPAN, MEMCACHED, REDIS } = cacheTypes;

const NO_CACHE_PROVIDER = cacheTypes.NO;

const { CYPRESS, CUCUMBER, GATLING } = testFrameworkTypes;
const { ANGULAR, REACT, VUE, SVELTE, NO } = clientFrameworkTypes;
const { ELASTICSEARCH } = searchEngineTypes;

const NO_SEARCH_ENGINE = searchEngineTypes.NO;
const COUCHBASE_SEARCH_ENGINE = searchEngineTypes.COUCHBASE;

const { EUREKA, CONSUL } = serviceDiscoveryTypes;

const NO_SERVICE_DISCOVERY = serviceDiscoveryTypes.NO;

const { SPRING_WEBSOCKET } = websocketTypes;

const NO_WEBSOCKET = websocketTypes.NO;

const ApplicationOptionTypes: Record<string, JDLApplicationOptionTypeValue> = {
  STRING: 'string',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  LIST: 'list',
};

const optionNames = {
  APPLICATION_TYPE: 'applicationType',
  AUTHENTICATION_TYPE: 'authenticationType',
  BASE_NAME: 'baseName',
  BLUEPRINT: 'blueprint',
  BLUEPRINTS: 'blueprints',
  BUILD_TOOL: 'buildTool',
  CACHE_PROVIDER: 'cacheProvider',
  CLIENT_FRAMEWORK: 'clientFramework',
  CLIENT_PACKAGE_MANAGER: 'clientPackageManager',
  CLIENT_THEME: 'clientTheme',
  CLIENT_THEME_VARIANT: 'clientThemeVariant',
  WITH_ADMIN_UI: 'withAdminUi',
  CREATION_TIMESTAMP: 'creationTimestamp',
  DATABASE_TYPE: 'databaseType',
  DEV_DATABASE_TYPE: 'devDatabaseType',
  DTO_SUFFIX: 'dtoSuffix',
  EMBEDDABLE_LAUNCH_SCRIPT: 'embeddableLaunchScript',
  ENABLE_HIBERNATE_CACHE: 'enableHibernateCache',
  ENABLE_SWAGGER_CODEGEN: 'enableSwaggerCodegen',
  ENABLE_TRANSLATION: 'enableTranslation',
  ENTITY_SUFFIX: 'entitySuffix',
  EXPERIMENTAL: 'experimental',
  GATEWAY_SERVER_PORT: 'gatewayServerPort',
  I_18_N: 'i18N',
  INSTALL_MODULES: 'installModules',
  JHI_PREFIX: 'jhiPrefix',
  JHIPSTER_VERSION: 'jhipsterVersion',
  JWT_SECRET_KEY: 'jwtSecretKey',
  LANGUAGES: 'languages',
  MICROFRONTEND: 'microfrontend',
  MICROFRONTENDS: 'microfrontends',
  NATIVE_LANGUAGE: 'nativeLanguage',
  NPM: 'npm',
  PACKAGE_NAME: 'packageName',
  PACKAGE_FOLDER: 'packageFolder',
  PROD_DATABASE_TYPE: 'prodDatabaseType',
  REACTIVE: 'reactive',
  REMEMBER_ME_KEY: 'rememberMeKey',
  SEARCH_ENGINE: 'searchEngine',
  SERVER_PORT: 'serverPort',
  SERVICE_DISCOVERY_TYPE: 'serviceDiscoveryType',
  SKIP_CLIENT: 'skipClient',
  SKIP_GIT: 'skipGit',
  SKIP_INSTALL: 'skipInstall',
  SKIP_SERVER: 'skipServer',
  SKIP_USER_MANAGEMENT: 'skipUserManagement',
  TEST_FRAMEWORKS: 'testFrameworks',
  WEBSOCKET: 'websocket',
  ENABLE_GRADLE_DEVELOCITY: 'enableGradleDevelocity',
  GRADLE_DEVELOCITY_HOST: 'gradleDevelocityHost',
} as const;

export const jhipsterOptionValues = {
  // TODO refactor it mixes default values (e.g. BaseName=Jhipster) and element list (e.g. application types)
  [optionNames.APPLICATION_TYPE]: {
    [APPLICATION_TYPE_MONOLITH]: APPLICATION_TYPE_MONOLITH,
    [APPLICATION_TYPE_MICROSERVICE]: APPLICATION_TYPE_MICROSERVICE,
    [APPLICATION_TYPE_GATEWAY]: APPLICATION_TYPE_GATEWAY,
  },
  [optionNames.AUTHENTICATION_TYPE]: {
    [JWT]: JWT,
    [OAUTH2]: OAUTH2,
    [SESSION]: SESSION,
  },
  [optionNames.BASE_NAME]: 'jhipster',
  [optionNames.BLUEPRINT]: undefined,
  [optionNames.BLUEPRINTS]: [],
  [optionNames.BUILD_TOOL]: {
    [MAVEN]: MAVEN,
    [GRADLE]: GRADLE,
  },
  [optionNames.CACHE_PROVIDER]: {
    [CAFFEINE]: CAFFEINE,
    [EHCACHE]: EHCACHE,
    [HAZELCAST]: HAZELCAST,
    [INFINISPAN]: INFINISPAN,
    [MEMCACHED]: MEMCACHED,
    [REDIS]: REDIS,
    [NO_CACHE_PROVIDER]: NO_CACHE_PROVIDER,
  },
  [optionNames.CLIENT_FRAMEWORK]: {
    [ANGULAR]: ANGULAR,
    [REACT]: REACT,
    [VUE]: VUE,
    [SVELTE]: SVELTE,
    [NO]: NO,
  },
  [optionNames.CLIENT_PACKAGE_MANAGER]: {
    npm: 'npm',
  },
  [optionNames.CLIENT_THEME]: 'none',
  [optionNames.DATABASE_TYPE]: {
    [SQL]: SQL,
    [MONGODB]: MONGODB,
    [CASSANDRA]: CASSANDRA,
    [COUCHBASE]: COUCHBASE,
    [NEO4J]: NEO4J,
    [NO_DATABASE]: NO_DATABASE,
  },
  [optionNames.DEV_DATABASE_TYPE]: {
    // these options + the prod database type
    [H2_DISK]: H2_DISK,
    [H2_MEMORY]: H2_MEMORY,
    [MYSQL]: MYSQL,
    [MARIADB]: MARIADB,
    [POSTGRESQL]: POSTGRESQL,
    [ORACLE]: ORACLE,
    [MSSQL]: MSSQL,
  },
  [optionNames.DTO_SUFFIX]: 'DTO',
  [optionNames.EMBEDDABLE_LAUNCH_SCRIPT]: true,
  [optionNames.ENABLE_HIBERNATE_CACHE]: true,
  [optionNames.ENABLE_SWAGGER_CODEGEN]: false,
  [optionNames.ENABLE_TRANSLATION]: true,
  [optionNames.ENTITY_SUFFIX]: '',
  [optionNames.EXPERIMENTAL]: false,
  [optionNames.I_18_N]: true,
  [optionNames.INSTALL_MODULES]: false,
  [optionNames.JHI_PREFIX]: 'jhi',
  [optionNames.JHIPSTER_VERSION]: '',
  [optionNames.JWT_SECRET_KEY]: '',
  [optionNames.LANGUAGES]: [],
  [optionNames.MICROFRONTEND]: false,
  [optionNames.MICROFRONTENDS]: [],
  [optionNames.NPM]: true,
  [optionNames.PACKAGE_NAME]: 'com.mycompany.myapp',
  [optionNames.PROD_DATABASE_TYPE]: {
    [MYSQL]: MYSQL,
    [MARIADB]: MARIADB,
    [POSTGRESQL]: POSTGRESQL,
    [ORACLE]: ORACLE,
    [MSSQL]: MSSQL,
    [NO_DATABASE]: NO_DATABASE,
  },
  [optionNames.REACTIVE]: false,
  [optionNames.REMEMBER_ME_KEY]: '',
  [optionNames.SEARCH_ENGINE]: {
    [ELASTICSEARCH]: ELASTICSEARCH,
    [COUCHBASE_SEARCH_ENGINE]: COUCHBASE_SEARCH_ENGINE,
    [NO_SEARCH_ENGINE]: NO_SEARCH_ENGINE,
  },
  [optionNames.SERVER_PORT]: 8080,
  [optionNames.SERVICE_DISCOVERY_TYPE]: {
    [EUREKA]: EUREKA,
    [CONSUL]: CONSUL,
    [NO_SERVICE_DISCOVERY]: NO_SERVICE_DISCOVERY,
  },
  [optionNames.SKIP_CLIENT]: false,
  [optionNames.SKIP_GIT]: false,
  [optionNames.SKIP_INSTALL]: false,
  [optionNames.SKIP_SERVER]: false,
  [optionNames.SKIP_USER_MANAGEMENT]: false,
  [optionNames.TEST_FRAMEWORKS]: {
    [CYPRESS]: CYPRESS,
    [CUCUMBER]: CUCUMBER,
    [GATLING]: GATLING,
  },
  [optionNames.WEBSOCKET]: {
    [SPRING_WEBSOCKET]: SPRING_WEBSOCKET,
    no: NO_WEBSOCKET,
  },
  [optionNames.WITH_ADMIN_UI]: true,
  [optionNames.ENABLE_GRADLE_DEVELOCITY]: false,
  [optionNames.GRADLE_DEVELOCITY_HOST]: '',
} as const satisfies Record<string, JDLApplicationOptionValue>;

export const jhipsterOptionTypes: Record<string, JDLApplicationOptionType> = {
  [optionNames.APPLICATION_TYPE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.AUTHENTICATION_TYPE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.BASE_NAME]: { type: ApplicationOptionTypes.STRING },
  [optionNames.BLUEPRINT]: { type: ApplicationOptionTypes.STRING },
  [optionNames.BLUEPRINTS]: { type: ApplicationOptionTypes.LIST },
  [optionNames.BUILD_TOOL]: { type: ApplicationOptionTypes.STRING },
  [optionNames.CACHE_PROVIDER]: { type: ApplicationOptionTypes.STRING },
  [optionNames.CLIENT_FRAMEWORK]: { type: ApplicationOptionTypes.STRING },
  [optionNames.CLIENT_PACKAGE_MANAGER]: { type: ApplicationOptionTypes.STRING },
  [optionNames.CLIENT_THEME]: { type: ApplicationOptionTypes.STRING },
  [optionNames.CLIENT_THEME_VARIANT]: { type: ApplicationOptionTypes.STRING },
  [optionNames.CREATION_TIMESTAMP]: { type: ApplicationOptionTypes.INTEGER },
  [optionNames.DATABASE_TYPE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.DEV_DATABASE_TYPE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.DTO_SUFFIX]: { type: ApplicationOptionTypes.STRING },
  [optionNames.EMBEDDABLE_LAUNCH_SCRIPT]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.ENABLE_HIBERNATE_CACHE]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.ENABLE_SWAGGER_CODEGEN]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.ENABLE_TRANSLATION]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.ENTITY_SUFFIX]: { type: ApplicationOptionTypes.STRING },
  [optionNames.EXPERIMENTAL]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.GATEWAY_SERVER_PORT]: { type: ApplicationOptionTypes.INTEGER },
  [optionNames.I_18_N]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.INSTALL_MODULES]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.JHI_PREFIX]: { type: ApplicationOptionTypes.STRING },
  [optionNames.JHIPSTER_VERSION]: { type: ApplicationOptionTypes.STRING },
  [optionNames.JWT_SECRET_KEY]: { type: ApplicationOptionTypes.STRING },
  [optionNames.LANGUAGES]: { type: ApplicationOptionTypes.LIST },
  [optionNames.MICROFRONTEND]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.MICROFRONTENDS]: { type: ApplicationOptionTypes.LIST },
  [optionNames.NATIVE_LANGUAGE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.NPM]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.PACKAGE_NAME]: { type: ApplicationOptionTypes.STRING },
  [optionNames.PACKAGE_FOLDER]: { type: ApplicationOptionTypes.STRING },
  [optionNames.PROD_DATABASE_TYPE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.REACTIVE]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.REMEMBER_ME_KEY]: { type: ApplicationOptionTypes.STRING },
  [optionNames.SEARCH_ENGINE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.SERVER_PORT]: { type: ApplicationOptionTypes.INTEGER },
  [optionNames.SERVICE_DISCOVERY_TYPE]: { type: ApplicationOptionTypes.STRING },
  [optionNames.SKIP_CLIENT]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.SKIP_GIT]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.SKIP_INSTALL]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.SKIP_SERVER]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.SKIP_USER_MANAGEMENT]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.TEST_FRAMEWORKS]: { type: ApplicationOptionTypes.LIST },
  [optionNames.WEBSOCKET]: { type: ApplicationOptionTypes.STRING },
  [optionNames.WITH_ADMIN_UI]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.ENABLE_GRADLE_DEVELOCITY]: { type: ApplicationOptionTypes.BOOLEAN },
  [optionNames.GRADLE_DEVELOCITY_HOST]: { type: ApplicationOptionTypes.STRING },
};

export const jhipsterQuotedOptionNames: string[] = [
  optionNames.JHIPSTER_VERSION,
  optionNames.REMEMBER_ME_KEY,
  optionNames.JWT_SECRET_KEY,
  optionNames.GRADLE_DEVELOCITY_HOST,
];

export const builtInJDLApplicationConfig: JDLApplicationConfig = {
  optionsTypes: jhipsterOptionTypes,
  // Don't validate built-in options.
  optionsValues: {},
  quotedOptionNames: jhipsterQuotedOptionNames,
  validatorConfig: builtInConfigPropsValidations,
  tokenConfigs: [],
};

export { optionNames as OptionNames };
export default {
  OptionNames: optionNames,
  OptionValues: jhipsterOptionValues,
  QuotedOptionNames: jhipsterQuotedOptionNames,
};
