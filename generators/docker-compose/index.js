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
const chalk = require('chalk');
const shelljs = require('shelljs');
const jsyaml = require('js-yaml');
const pathjs = require('path');
const writeFiles = require('./files').writeFiles;
const BaseDockerGenerator = require('../generator-base-docker');
const { GATEWAY, MONOLITH } = require('../../jdl/jhipster/application-types');
const { PROMETHEUS } = require('../../jdl/jhipster/monitoring-types');
const { EUREKA } = require('../../jdl/jhipster/service-discovery-types');
const { CASSANDRA, COUCHBASE, MARIADB, MONGODB, ORACLE } = require('../../jdl/jhipster/database-types');
const { ELASTICSEARCH } = require('../../jdl/jhipster/search-engine-types');
const { KAFKA } = require('../../jdl/jhipster/message-broker-types');
const { MEMCACHED, REDIS } = require('../../jdl/jhipster/cache-types');
const databaseTypes = require('../../jdl/jhipster/database-types');
const { GENERATOR_DOCKER_COMPOSE } = require('../generator-list');

const NO_DATABASE = databaseTypes.NO;

let useBlueprints;

/* eslint-disable consistent-return */
module.exports = class extends BaseDockerGenerator {
  constructor(args, options, features) {
    super(args, options, features);
    useBlueprints = !this.fromBlueprint && this.instantiateBlueprints(GENERATOR_DOCKER_COMPOSE);
  }

  _initializing() {
    return {
      ...super._initializing(),

      checkDockerCompose() {
        if (this.skipChecks) return;

        const done = this.async();

        shelljs.exec('docker-compose -v', { silent: true }, (code, stdout, stderr) => {
          if (stderr) {
            this.log(
              chalk.red(
                'Docker Compose 1.6.0 or later is not installed on your computer.\n' +
                  '         Read https://docs.docker.com/compose/install/\n'
              )
            );
          } else {
            const composeVersion = stdout.split(' ')[2].replace(/,/g, '');
            const composeVersionMajor = composeVersion.split('.')[0];
            const composeVersionMinor = composeVersion.split('.')[1];
            if (composeVersionMajor < 1 || (composeVersionMajor === 1 && composeVersionMinor < 6)) {
              this.log(
                chalk.red(
                  `$Docker Compose version 1.6.0 or later is not installed on your computer.
                                             Docker Compose version found: ${composeVersion}
                                             Read https://docs.docker.com/compose/install`
                )
              );
            }
          }
          done();
        });
      },
    };
  }

  get initializing() {
    if (useBlueprints) return;
    return this._initializing();
  }

  _prompting() {
    return super._prompting();
  }

  get prompting() {
    if (useBlueprints) return;
    return this._prompting();
  }

  _configuring() {
    return {
      sayHello() {
        this.log(chalk.white(`${chalk.bold('🐳')}  Welcome to the JHipster Docker Compose Sub-Generator ${chalk.bold('🐳')}`));
        this.log(chalk.white(`Files will be generated in folder: ${chalk.yellow(this.destinationRoot())}`));
      },

      ...super._configuring(),

      saveConfig() {
        this.config.set({
          appsFolders: this.appsFolders,
          directoryPath: this.directoryPath,
          gatewayType: this.gatewayType,
          clusteredDbApps: this.clusteredDbApps,
          monitoring: this.monitoring,
          serviceDiscoveryType: this.serviceDiscoveryType,
          jwtSecretKey: this.jwtSecretKey,
        });
      },
    };
  }

  get configuring() {
    if (useBlueprints) return;
    return this._configuring();
  }

  _loading() {
    return {
      loadPlatformConfig() {
        this.loadDeploymentConfig(this);
      },
    };
  }

  get loading() {
    if (useBlueprints) return;
    return this._loading();
  }

  _preparing() {
    return {
      checkAppsConfig() {
        let portIndex = 8080;
        this.serverPort = portIndex;
        const serverPorts = this.appConfigs.map(({ serverPort }) => serverPort);
        if (
          serverPorts.some(serverPort => !serverPort) ||
          !serverPorts.some(serverPort => serverPort === this.serverPort) ||
          serverPorts.length !== new Set(serverPorts).size
        ) {
          // create new ports in case some port is missing, root port doesn't exists, or duplicated ports
          this.appConfigs.forEach(appConfig => {
            appConfig.serverPort = portIndex;
            portIndex++;
          });
        }
      },

      loadConfig() {
        this.usesOauth2 = this.appConfigs.some(appConfig => appConfig.authenticationTypeOauth2);
        this.useKafka = this.appConfigs.some(({ messageBroker }) => messageBroker === KAFKA);
        this.useMemcached = this.appConfigs.some(({ cacheProvider }) => cacheProvider === MEMCACHED);
        this.authenticationType = this.appConfigs.find(({ authenticationType }) => authenticationType).authenticationType;

        this.keycloakRedirectUris = this.appConfigs
          .map(({ serverPort, devServerPort }) => {
            const keycloakRedirectUris = [`"http://localhost:${serverPort}/*", "https://localhost:${serverPort}/*"`];
            if (devServerPort !== undefined) {
              keycloakRedirectUris.push(`"http://localhost:${devServerPort}/*, "https://localhost:${devServerPort}/*""`);
            }
            return keycloakRedirectUris;
          })
          .flat()
          .join(', ');
      },

      setAppsYaml() {
        const services = this.appConfigs
          .map(
            ({
              baseName,
              applicationType,
              serverPort,
              skipClient,
              prodDatabaseType: database,
              clusteredDb,
              searchEngine,
              cacheProvider,
              appFolder,
              appRelativePath = this.directoryPath || './',
              platformMonitoring = this.monitoring,
              platformServiceDiscoveryType = this.serviceDiscoveryType,
              appPath = this.destinationPath(appRelativePath + appFolder),
            }) => {
              const appServices = [];
              const lowercaseBaseName = baseName.toLowerCase();
              // Add application configuration
              const yaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/app.yml`));
              const yamlConfig = yaml.services[`${lowercaseBaseName}-app`];
              if (applicationType === GATEWAY || applicationType === MONOLITH) {
                // Split ports by ":" and take last 2 elements to skip the hostname/IP if present
                const ports = yamlConfig.ports[0].split(':').slice(-2);
                ports[0] = serverPort;
                yamlConfig.ports[0] = ports.join(':');
              }

              if (applicationType === MONOLITH && platformMonitoring === PROMETHEUS) {
                yamlConfig.environment.push('JHIPSTER_LOGGING_LOGSTASH_ENABLED=false');
                yamlConfig.environment.push('MANAGEMENT_METRICS_EXPORT_PROMETHEUS_ENABLED=true');
              }

              if (this.serviceDiscoveryType === EUREKA) {
                // Set the JHipster Registry password
                yamlConfig.environment.push(`JHIPSTER_REGISTRY_PASSWORD=${this.adminPassword}`);
              }

              if (!platformServiceDiscoveryType && skipClient) {
                yamlConfig.environment.push('SERVER_PORT=80'); // to simplify service resolution in docker/k8s
              }

              appServices.push([`${lowercaseBaseName}`, yamlConfig]);

              // Add database configuration
              if (database !== NO_DATABASE && database !== ORACLE) {
                const relativePath = pathjs.relative(this.destinationRoot(), `${appPath}/src/main/docker`);
                const databaseYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/${database}.yml`));
                const databaseServiceName = `${lowercaseBaseName}-${database}`;
                let databaseYamlConfig = databaseYaml.services[databaseServiceName];
                if (database !== MARIADB) delete databaseYamlConfig.ports;

                if (database === CASSANDRA) {
                  // node config
                  const cassandraClusterYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/cassandra-cluster.yml`));
                  const cassandraNodeConfig = cassandraClusterYaml.services[`${databaseServiceName}-node`];
                  appServices.push([`${databaseServiceName}-node`, cassandraNodeConfig]);

                  // migration service config
                  const cassandraMigrationYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/cassandra-migration.yml`));
                  const cassandraMigrationConfig = cassandraMigrationYaml.services[`${databaseServiceName}-migration`];
                  cassandraMigrationConfig.build.context = relativePath;
                  const createKeyspaceScript = cassandraClusterYaml.services[`${databaseServiceName}-migration`].environment[0];
                  cassandraMigrationConfig.environment.push(createKeyspaceScript);
                  const cqlFilesRelativePath = pathjs.relative(this.destinationRoot(), `${appPath}/src/main/resources/config/cql`);
                  cassandraMigrationConfig.volumes[0] = `${cqlFilesRelativePath}:/cql:ro`;

                  appServices.push([`${databaseServiceName}-migration`, cassandraMigrationConfig]);
                }

                if (database === COUCHBASE) {
                  databaseYamlConfig.build.context = relativePath;
                }

                if (clusteredDb) {
                  const clusterDbYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/${database}-cluster.yml`));
                  const dbNodeConfig = clusterDbYaml.services[`${databaseServiceName}-node`];
                  dbNodeConfig.build.context = relativePath;
                  databaseYamlConfig = clusterDbYaml.services[databaseServiceName];
                  delete databaseYamlConfig.ports;
                  if (database === COUCHBASE) {
                    databaseYamlConfig.build.context = relativePath;
                  }
                  appServices.push([`${databaseServiceName}-node`, dbNodeConfig]);
                  if (database === MONGODB) {
                    appServices.push([`${databaseServiceName}-config`, clusterDbYaml.services[`${databaseServiceName}-config`]]);
                  }
                }

                appServices.push([databaseServiceName, databaseYamlConfig]);
              }
              // Add search engine configuration
              if (searchEngine === ELASTICSEARCH) {
                const searchEngineYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/${searchEngine}.yml`));
                const searchEngineConfig = searchEngineYaml.services[`${lowercaseBaseName}-${searchEngine}`];
                delete searchEngineConfig.ports;
                appServices.push([`${lowercaseBaseName}-${searchEngine}`, searchEngineConfig]);
              }

              // Add Memcached support
              if (cacheProvider === MEMCACHED) {
                const memcachedYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/memcached.yml`));
                const memcachedConfig = memcachedYaml.services[`${lowercaseBaseName}-memcached`];
                delete memcachedConfig.ports;
                appServices.push([`${lowercaseBaseName}-memcached`, memcachedConfig]);
              }

              // Add Redis support
              if (cacheProvider === REDIS) {
                const redisYaml = jsyaml.load(this.fs.read(`${appPath}/src/main/docker/redis.yml`));
                const redisConfig = redisYaml.services[`${lowercaseBaseName}-redis`];
                delete redisConfig.ports;
                appServices.push([`${lowercaseBaseName}-redis`, redisConfig]);
              }
              return appServices;
            }
          )
          .flat();
        // Dump the file
        this.yamlFile = jsyaml.dump({ services: Object.fromEntries(services) }, { indent: 2, lineWidth: -1 });
      },
    };
  }

  get preparing() {
    if (useBlueprints) return;
    return this._preparing();
  }

  _writing() {
    return writeFiles();
  }

  get writing() {
    if (useBlueprints) return;
    return this._writing();
  }

  _end() {
    if (this.hasWarning) {
      this.log(`\n${chalk.yellow.bold('WARNING!')} Docker Compose configuration generated, but no Jib cache found`);
      this.log('If you forgot to generate the Docker image for this application, please run:');
      this.log(chalk.red(this.warningMessage));
    } else {
      this.log(`\n${chalk.bold.green('Docker Compose configuration successfully generated!')}`);
    }
    this.log(`You can launch all your infrastructure by running : ${chalk.cyan('docker-compose up -d')}`);
    if (this.gatewayNb + this.monolithicNb > 1) {
      this.log('\nYour applications will be accessible on these URLs:');
      this.appConfigs.forEach(appConfig => {
        if (appConfig.applicationType === GATEWAY || appConfig.applicationType === MONOLITH) {
          this.log(`\t- ${appConfig.baseName}: http://localhost:${appConfig.serverPort}`);
        }
      });
      this.log('\n');
    }
  }

  end() {
    if (useBlueprints) return;
    return this._end();
  }
};
