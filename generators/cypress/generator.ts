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

import { createFaker, stringHashCode } from '../base/support/index.js';
import BaseApplicationGenerator from '../base-application/index.js';
import { clientFrameworkTypes } from '../../lib/jhipster/index.js';

import { generateTestEntity as entityWithFakeValues } from '../client/support/index.js';
import { cypressEntityFiles, cypressFiles } from './files.js';

const { ANGULAR } = clientFrameworkTypes;

const WAIT_TIMEOUT = 3 * 60000;

export default class CypressGenerator extends BaseApplicationGenerator {
  async beforeQueue() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints();
    }

    if (!this.delegateToBlueprint) {
      // TODO depend on GENERATOR_BOOTSTRAP_APPLICATION_CLIENT.
      await this.dependsOnBootstrapApplication();
    }
  }

  get prompting() {
    return this.asPromptingTaskGroup({
      async askForCypressOptions({ control }) {
        if (control.existingProject && !this.options.askAnswered) return;
        await (this.prompt as any)(
          [
            {
              when: this.jhipsterConfig?.clientFramework === ANGULAR,
              type: 'confirm',
              name: 'cypressCoverage',
              message: 'Would you like to generate code coverage for Cypress tests? [Experimental]',
            },
            {
              type: 'confirm',
              name: 'cypressAudit',
              message: 'Would you like to audit Cypress tests?',
            },
          ],
          this.config,
        );
      },
    });
  }

  get [BaseApplicationGenerator.PROMPTING]() {
    return this.delegateTasksToBlueprint(() => this.prompting);
  }

  get loading() {
    return this.asLoadingTaskGroup({
      loadPackageJson({ application }) {
        this.loadNodeDependenciesFromPackageJson(
          application.nodeDependencies,
          this.fetchFromInstalledJHipster('client', 'resources', 'package.json'),
        );
      },

      prepareForTemplates({ application }) {
        const { cypressAudit = true, cypressCoverage = false } = this.jhipsterConfig as any;
        application.cypressAudit = cypressAudit;
        application.cypressCoverage = cypressCoverage;
      },
    });
  }

  get [BaseApplicationGenerator.LOADING]() {
    return this.delegateTasksToBlueprint(() => this.loading);
  }

  get preparing() {
    return this.asPreparingTaskGroup({
      prepareForTemplates({ application }) {
        application.cypressDir = (application.cypressDir ?? application.clientTestDir) ? `${application.clientTestDir}cypress/` : 'cypress';
        application.cypressTemporaryDir =
          (application.cypressTemporaryDir ?? application.temporaryDir) ? `${application.temporaryDir}cypress/` : '.cypress/';
        application.cypressBootstrapEntities = application.cypressBootstrapEntities ?? true;
      },
      npmScripts({ application }) {
        const { dasherizedBaseName, devServerPort, devServerPortProxy: devServerPortE2e = devServerPort } = application;

        Object.assign(application.clientPackageJsonScripts, {
          cypress: application.clientFrameworkAngular ? undefined : 'cypress open --e2e',
          'e2e:cypress': application.clientFrameworkAngular ? undefined : 'cypress run --e2e --browser chrome',
          'e2e:cypress:headed': application.clientFrameworkAngular ? undefined : 'npm run e2e:cypress -- --headed',
          'e2e:cypress:record': application.clientFrameworkAngular ? undefined : 'npm run e2e:cypress -- --record',
          'e2e:headless': application.clientFrameworkAngular ? 'ng e2e --configuration baseHref' : 'npm run e2e:cypress --',
          e2e: application.clientFrameworkAngular ? 'ng e2e' : 'npm run e2e:cypress:headed --',
        });

        // Scripts that handle server and client concurrently should be added to the root package.json
        Object.assign(application.packageJsonScripts, {
          'ci:e2e:run': 'concurrently -k -s first -n application,e2e -c red,blue npm:ci:e2e:server:start npm:e2e:headless',
          'ci:e2e:dev': `concurrently -k -s first -n application,e2e -c red,blue npm:app:start npm:e2e:headless`,
          'e2e:dev': `concurrently -k -s first -n application,e2e -c red,blue npm:app:start npm:e2e`,
          'e2e:devserver': application.clientFrameworkAngular
            ? `concurrently -k -s first -n backend,e2e -c red,blue npm:backend:start "npm run ci:server:await && ng e2e --configuration ${application.cypressCoverage ? 'coverage' : 'run'}"`
            : `concurrently -k -s first -n backend,frontend,e2e -c red,yellow,blue npm:backend:start npm:start "wait-on -t ${WAIT_TIMEOUT} http-get://127.0.0.1:${devServerPortE2e} && npm run e2e:headless -- -c baseUrl=http://localhost:${devServerPortE2e}"`,
        });

        if (application.clientRootDir) {
          // Add scripts to map to client package.json
          Object.assign(application.packageJsonScripts, {
            'e2e:headless': `npm run -w ${application.clientRootDir} e2e:headless`,
          });
        } else if (application.backendTypeJavaAny) {
          Object.assign(application.clientPackageJsonScripts, {
            'pree2e:headless': 'npm run ci:server:await',
          });
        }
      },
    });
  }

  get [BaseApplicationGenerator.PREPARING]() {
    return this.delegateTasksToBlueprint(() => this.preparing);
  }

  get preparingEachEntity() {
    return this.asPreparingEachEntityTaskGroup({
      prepareForTemplates({ entity }) {
        this._.defaults(entity, { workaroundEntityCannotBeEmpty: false, workaroundInstantReactiveMariaDB: false });
      },
    });
  }

  get [BaseApplicationGenerator.PREPARING_EACH_ENTITY]() {
    return this.delegateTasksToBlueprint(() => this.preparingEachEntity);
  }

  get writing() {
    return this.asWritingTaskGroup({
      async cleanup({ control, application: { authenticationTypeOauth2, generateUserManagement, cypressDir } }) {
        if (this.isJhipsterVersionLessThan('7.0.0-beta.1')) {
          this.removeFile(`${cypressDir}support/keycloak-oauth2.ts`);
          this.removeFile(`${cypressDir}fixtures/users/user.json`);
        }
        if (this.isJhipsterVersionLessThan('7.8.2')) {
          this.removeFile('cypress.json');
          this.removeFile('cypress-audits.json');

          this.removeFile(`${cypressDir}integration/administration/administration.spec.ts`);
          this.removeFile(`${cypressDir}integration/lighthouse.audits.ts`);
          if (!authenticationTypeOauth2) {
            this.removeFile(`${cypressDir}integration/account/login-page.spec.ts`);
          }
          if (generateUserManagement) {
            this.removeFile(`${cypressDir}integration/account/register-page.spec.ts`);
            this.removeFile(`${cypressDir}integration/account/settings-page.spec.ts`);
            this.removeFile(`${cypressDir}integration/account/password-page.spec.ts`);
            this.removeFile(`${cypressDir}integration/account/reset-password-page.spec.ts`);
          }
        }

        await control.cleanupFiles({ '8.6.1': [`${cypressDir}.eslintrc.json`] });
      },
      async writeFiles({ application }) {
        const faker = await createFaker();
        faker.seed(stringHashCode(application.baseName));
        const context = { ...application, faker } as any;
        return this.writeFiles({
          sections: cypressFiles,
          context,
        });
      },
    });
  }

  get [BaseApplicationGenerator.WRITING]() {
    return this.delegateTasksToBlueprint(() => this.writing);
  }

  get writingEntities() {
    return this.asWritingEntitiesTaskGroup({
      cleanupCypressEntityFiles({ application: { cypressDir }, entities }) {
        for (const entity of entities) {
          if (this.isJhipsterVersionLessThan('7.8.2')) {
            this.removeFile(`${cypressDir}integration/entity/${entity.entityFileName}.spec.ts`);
          }
        }
      },

      async writeCypressEntityFiles({ application, entities }) {
        for (const entity of entities.filter(
          entity => !entity.skipClient && !entity.embedded && !entity.builtInUser && !entity.entityClientModelOnly,
        )) {
          const context = { ...application, ...entity } as any;
          await this.writeFiles({
            sections: cypressEntityFiles,
            context,
          });
        }
      },
    });
  }

  get [BaseApplicationGenerator.WRITING_ENTITIES]() {
    return this.delegateTasksToBlueprint(() => this.writingEntities);
  }

  get postWriting() {
    return this.asPostWritingTaskGroup({
      packageJson({ application }) {
        const clientPackageJson = this.createStorage(this.destinationPath(application.clientRootDir!, 'package.json'));
        clientPackageJson.merge({
          devDependencies: {
            'eslint-plugin-cypress': application.nodeDependencies['eslint-plugin-cypress'],
          },
        });
      },
      cypressSchematics({ application, source }) {
        const { applicationTypeMicroservice, clientFrameworkAngular, dasherizedBaseName, clientRootDir, gatewayServerPort, serverPort } =
          application;
        if (!clientFrameworkAngular) return;

        source.mergeClientPackageJson?.({
          devDependencies: {
            '@cypress/schematic': null,
          },
        });
        this.mergeDestinationJson(`${clientRootDir}angular.json`, {
          projects: {
            [application.dasherizedBaseName]: {
              architect: {
                e2e: {
                  builder: '@cypress/schematic:cypress',
                  options: {
                    browser: 'chrome',
                  },
                  configurations: {
                    baseHref: {
                      headless: true,
                      baseUrl: `http://localhost:${applicationTypeMicroservice ? gatewayServerPort : serverPort}`,
                    },
                    open: {
                      watch: true,
                      devServerTarget: `${dasherizedBaseName}:serve`,
                    },
                    openProduction: {
                      watch: true,
                      devServerTarget: `${dasherizedBaseName}:serve:production`,
                    },
                    run: {
                      headless: true,
                      devServerTarget: `${dasherizedBaseName}:serve`,
                    },
                    runProduction: {
                      headless: true,
                      devServerTarget: `${dasherizedBaseName}:serve:production`,
                    },
                  },
                  defaultConfiguration: 'open',
                },
              },
            },
          },
        });
      },
      configureAudits({ application }) {
        if (!application.cypressAudit) return;
        const clientPackageJson = this.createStorage(this.destinationPath(application.clientRootDir!, 'package.json'));
        clientPackageJson.merge({
          devDependencies: {
            lighthouse: application.nodeDependencies.lighthouse,
            'cypress-audit': application.nodeDependencies['cypress-audit'],
          },
          scripts: {
            'cypress:audits': 'cypress open --e2e --config-file cypress-audits.config.js',
            'e2e:cypress:audits:headless': 'npm run e2e:cypress -- --config-file cypress-audits.config.js',
            'e2e:cypress:audits': 'cypress run --e2e --browser chrome --config-file cypress-audits.config.js',
          },
        });
      },
      configureCoverage({ application }) {
        const { cypressCoverage, clientFrameworkAngular, clientRootDir, dasherizedBaseName } = application;
        if (!cypressCoverage) return;
        const clientPackageJson = this.createStorage(this.destinationPath(application.clientRootDir!, 'package.json'));
        clientPackageJson.merge({
          devDependencies: {
            'cypress-monocart-coverage': null,
          },
          scripts: {
            'pree2e:cypress:coverage': 'npm run ci:server:await',
            'e2e:cypress:coverage': 'ng e2e --configuration coverage',
          },
        });

        if (clientFrameworkAngular) {
          this.mergeDestinationJson(`${clientRootDir}angular.json`, {
            projects: {
              [dasherizedBaseName]: {
                architect: {
                  build: { configurations: { coverage: { sourceMap: true, namedChunks: true } } },
                  serve: { configurations: { coverage: { buildTarget: `${dasherizedBaseName}:build:coverage` } } },
                  e2e: {
                    configurations: {
                      coverage: {
                        headless: true,
                        devServerTarget: `${dasherizedBaseName}:serve:coverage`,
                        env: { CYPRESS_COVERAGE: true },
                      },
                      openCoverage: {
                        watch: true,
                        devServerTarget: `${dasherizedBaseName}:serve:coverage`,
                        env: { CYPRESS_COVERAGE: true },
                      },
                    },
                  },
                },
              },
            },
          });
        }
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return this.delegateTasksToBlueprint(() => this.postWriting);
  }

  generateTestEntity(references) {
    return entityWithFakeValues(references);
  }
}
