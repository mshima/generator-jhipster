/**
 * Copyright 2013-2024 the original author or authors from the JHipster project.
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
import BaseApplicationGenerator from '../../../base-application/index.js';

export default class PrettierGenerator extends BaseApplicationGenerator {
  fromInit?: boolean;
  prettierConfigFile!: string;
  monorepositoryRoot?: boolean;

  constructor(args, opts, features) {
    super(args, opts, { queueCommandTasks: true, ...features });
  }

  async beforeQueue() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints();
    }

    if (!this.delegateToBlueprint && !this.options.fromInit) {
      await this.dependsOnBootstrapApplication();
    }
  }

  get loading() {
    return this.asLoadingTaskGroup({
      defaults({ applicationDefaults }) {
        applicationDefaults({
          prettierTabWidth: 2,
        });
      },
    });
  }

  get [BaseApplicationGenerator.LOADING]() {
    return this.delegateTasksToBlueprint(() => this.loading);
  }

  get preparing() {
    return this.asPreparingTaskGroup({
      source({ source }) {
        source.mergePrettierConfig = config => this.mergeDestinationYaml(this.prettierConfigFile, config);
      },
      preparing({ applicationDefaults }) {
        applicationDefaults({ temporaryDir: undefined });
      },
    });
  }

  get [BaseApplicationGenerator.PREPARING]() {
    return this.delegateTasksToBlueprint(() => this.preparing);
  }

  get writing() {
    return this.asWritingTaskGroup({
      async writing({ application }) {
        await this.writeFiles({
          blocks: [
            { templates: [{ sourceFile: '.prettierrc.yml.jhi', destinationFile: `${this.prettierConfigFile}.jhi` }] },
            { templates: ['.prettierignore.jhi'] },
          ],
          context: application,
        });
      },
    });
  }

  get [BaseApplicationGenerator.WRITING]() {
    return this.delegateTasksToBlueprint(() => this.writing);
  }

  get postWriting() {
    return this.asPostWritingTaskGroup({
      addPrettierDependencies({ application }) {
        this.packageJson.merge({
          devDependencies: {
            prettier: application.nodeDependencies.prettier,
          },
        });
        if (application.monorepository && !this.monorepositoryRoot) return;

        if (this.fromInit) {
          this.packageJson.merge({
            scripts: {
              'prettier-check': 'prettier --check "{,**/}*.{md,json,yml,html,cjs,mjs,js,cts,mts,ts,tsx,css,scss,vue,java}"',
              'prettier-format': 'prettier --write "{,**/}*.{md,json,yml,html,cjs,mjs,js,cts,mts,ts,tsx,css,scss,vue,java}"',
            },
          });
        }
      },
      addPrettierPackagejson({ application, source }) {
        source.mergePrettierConfig({ plugins: ['prettier-plugin-packagejson'] });
        this.packageJson.merge({
          devDependencies: {
            'prettier-plugin-packagejson': application.nodeDependencies['prettier-plugin-packagejson'],
          },
        });
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return this.delegateTasksToBlueprint(() => this.postWriting);
  }
}
