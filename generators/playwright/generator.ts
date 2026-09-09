/**
 * Copyright 2013-2026 the original author or authors from the JHipster project.
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

import { clientFrameworkTypes } from '../../lib/jhipster/index.ts';
import { mutateData, stringHashCode } from '../../lib/utils/index.ts';
import BaseApplicationGenerator from '../base-application/index.ts';
import { createFaker } from '../base-application/support/index.ts';
import { generateTestEntity } from '../client/support/index.ts';
import type { Source as ClientSource } from '../client/types.ts';
import type { Source as JavaSource } from '../java/types.d.ts';

import { playwrightEntityFiles, playwrightFiles } from './files.ts';
import type {
  Application as PlaywrightApplication,
  Config as PlaywrightConfig,
  Entity as PlaywrightEntity,
  Features as PlaywrightFeatures,
  Field as PlaywrightField,
  Options as PlaywrightOptions,
} from './types.ts';

const { ANGULAR } = clientFrameworkTypes;

const WAIT_TIMEOUT = 3 * 60000;

export default class PlaywrightGenerator extends BaseApplicationGenerator<PlaywrightEntity, PlaywrightApplication, PlaywrightConfig> {
  angularSchematic = false;

  constructor(args?: string[], options?: PlaywrightOptions, features?: PlaywrightFeatures) {
    super(args, options, { ...features, loadCommand: ['jhipster:server'] });
  }

  async beforeQueue() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints();
    }

    if (!this.delegateToBlueprint) {
      await this.dependsOnBootstrap('client');
      await this.dependsOnJHipster('javascript-simple-application');
    }
  }

  get prompting() {
    return this.asPromptingTaskGroup({
      async askForPlaywrightOptions({ control }) {
        if (control.existingProject && !this.options.askAnswered) return;
        await this.prompt(
          [
            {
              when: (this.jhipsterConfig as any).clientFramework === ANGULAR,
              type: 'confirm',
              name: 'playwrightSchematic',
              message: 'Would you like to register the Playwright builder in angular.json?',
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

  get preparing() {
    return this.asPreparingTaskGroup({
      loadPackageJson({ application }) {
        this.loadNodeDependenciesFromPackageJson(
          application.nodeDependencies,
          this.fetchFromInstalledJHipster('playwright', 'resources', 'package.json'),
        );
      },
      prepareForTemplates({ applicationDefaults }) {
        applicationDefaults({
          playwrightSchematic: false,
          playwrightDir: ({ clientTestDir }) => (clientTestDir ? `${clientTestDir}playwright/` : 'playwright/'),
          playwrightTemporaryDir: ({ temporaryDir }) => (temporaryDir ? `${temporaryDir}playwright/` : '.playwright/'),
          playwrightBootstrapEntities: true,
        });
      },
      npmScripts({ application }) {
        const { devServerPort, devServerPortProxy: devServerPortE2e = devServerPort } = application;
        // The Angular schematic is opt-in, so the dev server is always started explicitly and waited for.
        this.angularSchematic = Boolean(application.clientFrameworkAngular) && Boolean(application.playwrightSchematic);
        // The Angular dev server listens on localhost only (which may resolve to ::1), Vite listens on every address.
        const devServerHost = application.clientFrameworkAngular ? 'localhost' : '127.0.0.1';

        Object.assign(application.clientPackageJsonScripts, {
          playwright: 'playwright test --ui',
          e2e: 'npm run e2e:playwright:headed --',
          'e2e:playwright': 'playwright test --project=chromium',
          'e2e:playwright:headed': 'npm run e2e:playwright -- --headed',
          'e2e:headless': 'npm run e2e:playwright --',
        });

        // Scripts that handle server and client concurrently should be added to the root package.json
        Object.assign(application.packageJsonScripts, {
          'ci:e2e:run': 'concurrently -k -s first -n application,e2e -c red,blue npm:ci:e2e:server:start npm:e2e:headless',
          'ci:e2e:dev': `concurrently -k -s first -n application,e2e -c red,blue npm:app:start npm:e2e:headless`,
          'e2e:dev': `concurrently -k -s first -n application,e2e -c red,blue npm:app:start npm:e2e`,
          'e2e:devserver': `concurrently -k -s first -n backend,frontend,e2e -c red,yellow,blue npm:backend:start npm:start "wait-on -t ${WAIT_TIMEOUT} http-get://${devServerHost}:${devServerPortE2e} && npm run e2e:headless -- --base-url=http://localhost:${devServerPortE2e}"`,
        });

        Object.assign(application.packageJsonScripts, {
          'pree2e:headless': 'npm run ci:server:await --if-present',
        });

        if (application.clientRootDir) {
          // Add scripts forwarding to client package.json
          for (const script of ['e2e:headless'].filter(script => application.clientPackageJsonScripts[script])) {
            application.packageJsonScripts[script] = `npm run -w ${application.clientRootDir} ${script}`;
          }
        }
      },
    });
  }

  get [BaseApplicationGenerator.PREPARING]() {
    return this.delegateTasksToBlueprint(() => this.preparing);
  }

  get postPreparingEachEntity() {
    return this.asPreparingEachEntityTaskGroup({
      prepareForTemplates({ entity }) {
        mutateData(entity, {
          generateEntityPlaywright: ({ builtInUserManagement, skipClient }) => !skipClient || builtInUserManagement,
        });
      },
    });
  }

  get [BaseApplicationGenerator.POST_PREPARING_EACH_ENTITY]() {
    return this.delegateTasksToBlueprint(() => this.postPreparingEachEntity);
  }

  get writing() {
    return this.asWritingTaskGroup({
      async writeFiles({ application }) {
        const faker = await createFaker();
        faker.seed(stringHashCode(application.baseName));
        const context = { ...application, faker };
        return this.writeFiles({
          sections: playwrightFiles,
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
      async writePlaywrightEntityFiles({ application, entities }) {
        for (const entity of entities.filter(
          entity => entity.generateEntityPlaywright && !entity.embedded && !entity.builtInUser && !entity.entityClientModelOnly,
        )) {
          const context = { ...application, ...entity };
          await this.writeFiles({
            sections: playwrightEntityFiles,
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
        const clientPackageJson = this.createStorage(this.destinationPath(application.clientRootDir, 'package.json'));
        clientPackageJson.merge({
          devDependencies: {
            '@playwright/test': application.nodeDependencies['@playwright/test'],
            'eslint-plugin-playwright': application.nodeDependencies['eslint-plugin-playwright'],
          },
        });
        this.packageJson.merge({
          allowScripts: {
            '@playwright/test': true,
          },
        });
      },
      playwrightSchematics({ application, source }) {
        const { applicationTypeMicroservice, dasherizedBaseName, clientRootDir, gatewayServerPort, serverPort } = application;
        if (!this.angularSchematic) return;

        (source as ClientSource).mergeClientPackageJson?.({
          devDependencies: {
            'playwright-ng-schematics': null,
          },
        });
        this.mergeDestinationJson(`${clientRootDir}angular.json`, {
          projects: {
            [dasherizedBaseName]: {
              architect: {
                e2e: {
                  builder: 'playwright-ng-schematics:playwright',
                  options: {
                    devServerTarget: `${dasherizedBaseName}:serve`,
                  },
                  configurations: {
                    production: {
                      devServerTarget: `${dasherizedBaseName}:serve:production`,
                    },
                    baseHref: {
                      baseUrl: `http://localhost:${applicationTypeMicroservice ? gatewayServerPort : serverPort}`,
                    },
                  },
                },
              },
            },
          },
        });
      },
      mavenProfile({ source }) {
        (source as JavaSource).addMavenProfile?.({
          id: 'e2e',
          content: `
            <properties>
                <profile.e2e>,e2e</profile.e2e>
            </properties>
            <build>
                <finalName>e2e</finalName>
            </build>
          `,
        });
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return this.delegateTasksToBlueprint(() => this.postWriting);
  }

  generateTestEntity(fields: PlaywrightField[]) {
    return generateTestEntity(fields);
  }
}
