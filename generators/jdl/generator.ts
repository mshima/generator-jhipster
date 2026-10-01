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
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { type Store as MemFs, create as createMemFs } from 'mem-fs';
import { type MemFsEditor, type MemFsEditorFile, create as createMemFsEditor } from 'mem-fs-editor';
import { isFilePending } from 'mem-fs-editor/state';

import { downloadJdlFile } from '../../cli/download.ts';
import EnvironmentBuilder from '../../cli/environment-builder.ts';
import { CLI_NAME } from '../../cli/utils.ts';
import type { YoRcFileContent } from '../../lib/constants/yeoman.ts';
import { convertJDLToFiles } from '../../lib/jdl/convert-jdl-to-files.ts';
import { applyStackConfig } from '../../lib/jdl/converters/ast-to-files/stack-config.ts';
import { createJDLRuntime } from '../../lib/jdl-config/jdl-runtime.ts';
import { mergeYoRcContent } from '../../lib/utils/yo-rc.ts';
import BaseGenerator from '../base/index.ts';
import { updateApplicationEntitiesTransform } from '../base-application/support/update-application-entities-transform.ts';
import type { Options as BootstrapOptions } from '../bootstrap/types.d.ts';
import type { Options as GitOptions } from '../git/types.d.ts';

import { allNewApplications, resolveJDLDefinitions } from './internal/index.ts';
import { type JDLApplication, isDeploymentConfig, readGenerationTargets, toDestinationFiles } from './internal/jdl-files.ts';
import type { Config as JdlConfig, Options as JdlOptions } from './types.ts';

/**
 * Add jdl extension to the file
 */
const toJdlFile = (file: string): string => {
  if (!extname(file)) {
    return `${file}.jdl`;
  }
  return file;
};

type ApplicationWithEntitiesAndPath = JDLApplication & { sharedFs?: MemFs<MemFsEditorFile> };

export default class JdlGenerator extends BaseGenerator<JdlConfig, JdlOptions> {
  jdlFiles?: string[];
  inline?: string;
  jdlContents: string[] = [];
  entrypointGenerator = `${CLI_NAME}:app`;
  entitiesGenerator = 'entities';
  workspacesGenerator = 'workspaces';

  interactive?: boolean;
  jsonOnly?: boolean;
  ignoreApplication?: boolean;
  ignoreDeployments?: boolean;
  skipSampleRepository?: boolean;
  force?: boolean;
  reproducible?: boolean;
  createEnvBuilder = EnvironmentBuilder.createDefaultBuilder;
  existingProject?: boolean;

  /** The json files of the jdl, by path relative to the destination root. */
  files!: Record<string, Record<string, any>>;
  applications!: ApplicationWithEntitiesAndPath[];
  /** The entities of a jdl without application. */
  entityNames!: string[];
  deploymentFolders!: string[];

  async beforeQueue() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints();
    }
  }

  get initializing() {
    return this.asInitializingTaskGroup({
      loadArguments() {
        if (this.jdlFiles) {
          this.log.verboseInfo('Generating jdls', ...this.jdlFiles);
        }
      },
      initializeOptions() {
        // The cli gives the builder of its environment: the applications are generated in environments built like it,
        // with its blueprints and lookups.
        if (this.options.createEnvBuilder) {
          this.createEnvBuilder = this.options.createEnvBuilder;
        }
      },
      existingProject() {
        this.existingProject = this.jhipsterConfig.baseName !== undefined && this.config.existed;
      },
      checkOptions() {
        if (!this.skipChecks && !this.inline && !this.jdlFiles?.length) {
          throw new Error('At least one jdl file is required.');
        }
      },
    });
  }

  get [BaseGenerator.INITIALIZING]() {
    return this.delegateTasksToBlueprint(() => this.initializing);
  }

  get configuring() {
    return this.asConfiguringTaskGroup({
      async downloadJdlFiles() {
        if (this.jdlFiles) {
          this.jdlFiles = await Promise.all(
            this.jdlFiles.map(toJdlFile).map(async filename => {
              try {
                this.readDestination(filename);
              } catch {
                this.log.warn(`File not found: ${filename}. Attempting download from jdl-samples repository`);
                const downloadedFile = await downloadJdlFile(filename, { skipSampleRepository: this.skipSampleRepository });
                // The file has null content at mem-fs, update with actual content.
                this.writeDestination(downloadedFile, (await readFile(downloadedFile)).toString());
                return downloadedFile;
              }
              return filename;
            }),
          );
        }
      },
      readJdlFiles() {
        if (this.inline) {
          this.jdlContents.push(this.inline);
        }
        for (const jdlFile of this.jdlFiles ?? []) {
          this.jdlContents.push(this.readDestination(jdlFile) ?? '');
        }
      },
      async parseJDL() {
        const target = {
          applicationName: this.options.baseName ?? (this.existingProject ? this.jhipsterConfig.baseName : undefined),
          applicationType: this.options.applicationType ?? (this.existingProject ? this.jhipsterConfig.applicationType : undefined),
        };
        this.files = toDestinationFiles(
          applyStackConfig(convertJDLToFiles(this.jdlContents.join('\n'), createJDLRuntime(resolveJDLDefinitions(this.options)))),
        );
        const { applications, entityNames, deploymentFolders } = readGenerationTargets(this.files);
        if (applications.length === 0 && entityNames.length > 0 && !target.applicationName) {
          throw new Error(
            'A jdl declaring entities without application is imported into an application: run it in the folder of one, or pass its base name.',
          );
        }

        this.entityNames = entityNames;
        this.deploymentFolders = deploymentFolders;
        this.applications =
          applications.length === 1 ?
            applications
          : [
              ...applications.filter(app => app.config.applicationType === 'gateway'),
              ...applications.filter(app => app.config.applicationType !== 'gateway'),
            ];
      },
      configure() {
        const nrApplications = this.applications.length;
        const allNew = allNewApplications(this.applications);
        const interactiveFallback = !allNew;

        this.interactive ??= interactiveFallback;
        this.force = (this.options.force ?? (nrApplications > 0 && allNew)) ? true : undefined;
        this.reproducible = allNew;
      },
      customizeApplication() {
        if (this.applications.length > 1 && !this.interactive && !this.jsonOnly && !this.ignoreApplication) {
          for (const app of this.applications) {
            app.sharedFs = createMemFs();
          }
        }
      },
      async generateJson() {
        this.writeJDLFiles();
        if (this.applications.length === 0) {
          await this.env.sharedFs.pipeline(
            { refresh: true },
            updateApplicationEntitiesTransform({ destinationPath: this.destinationPath(), throwOnMissingConfig: false }),
          );
        }
      },
      async generate() {
        if (this.jsonOnly) {
          return;
        }

        const generatorOptions: any = { defaults: true, reproducible: this.options.reproducible ?? this.reproducible, force: this.force };

        if (this.ignoreApplication !== false && (this.ignoreApplication || this.applications.length === 0)) {
          if (this.applications.length === 0) {
            await this.composeWithJHipster(this.entitiesGenerator, {
              generatorArgs: this.entityNames,
              generatorOptions: {
                ...generatorOptions,
                // Generation should match entities command behavior.
                commandName: 'entities',
              },
            });
          } else {
            for (const app of this.applications) {
              await this.composeWithJHipster(this.entitiesGenerator, {
                generatorArgs: app.entityNames,
                generatorOptions: {
                  ...generatorOptions,
                  destinationRoot: app.folder ? this.destinationPath(app.folder) : undefined,
                },
              });
            }
          }
        } else if (this.applications.length > 1) {
          this.log.info(`Generating ${this.applications.length} applications`);
          await this.composeWithJHipster(this.workspacesGenerator as 'workspaces', {
            generatorOptions: {
              /** TODO types contains appsFolders which is not correctly handled, {@see file:../workspaces/command.ts} */
              workspacesFolders: this.applications.map(app => app.folder),
              generateApplications: async () => this.runNonInteractive(this.applications, generatorOptions),
            } as any,
          });
        } else {
          this.log.info('Generating 1 application');
          await this.composeWithJHipster(this.entrypointGenerator, { generatorOptions });
        }
      },
    });
  }

  get [BaseGenerator.CONFIGURING]() {
    return this.delegateTasksToBlueprint(() => this.configuring);
  }

  get end() {
    return this.asEndTaskGroup({
      async generateDeployments() {
        if (!this.deploymentFolders?.length) {
          this.log.info('No deployment configured');
          return;
        }
        if (this.ignoreDeployments) {
          this.log.info(`Ignoring ${this.deploymentFolders.length} deployments`);
          return;
        }

        this.log.info(`Generating ${this.deploymentFolders.length} deployments`);
        for (const folder of this.deploymentFolders) {
          this.log.debug(`Generating deployment in ${folder}`);

          // The deployment generator delegates to the one of the deploymentType, in the folder of the deployment.
          await this.composeWithJHipster('deployment', {
            generatorOptions: {
              destinationRoot: this.destinationPath(folder),
              force: true,
            },
          });
        }
      },
    });
  }

  get [BaseGenerator.END]() {
    return this.delegateTasksToBlueprint(() => this.end);
  }

  async runNonInteractive(applications: ApplicationWithEntitiesAndPath[], options: any) {
    // The archive is written once, by the workspace root, children defer their commit and hand the files over.
    const deferCommit = Boolean((this.options as BootstrapOptions).exportApplication) && applications.length > 1;
    await Promise.all(
      applications.map(async application => {
        const rootCwd = this.destinationPath();
        const cwd = application.folder ? this.destinationPath(application.folder) : rootCwd;
        const adapter = this.env.adapter.newAdapter();
        const envOptions: any = { cwd, logCwd: rootCwd, sharedFs: application.sharedFs, adapter };
        const generatorOptions = { ...this.options, ...options, skipPriorities: ['prompting'] };

        if (deferCommit) {
          generatorOptions.exportApplication = undefined;
          generatorOptions.deferCommit = true;
        }

        // Install should happen at the root of the monorepository. Force skip install at children.
        if ((this.options as GitOptions).monorepository) {
          generatorOptions.skipInstall = true;
        }
        const envBuilder = await this.createEnvBuilder(envOptions, { disableBlueprints: this.options.disableBlueprints });
        const env = envBuilder.getEnvironment();
        await env.run([this.entrypointGenerator], generatorOptions);

        if (deferCommit && application.sharedFs) {
          // Every environment commits its own mem-fs: the files must be moved to this environment's mem-fs before it
          // commits, otherwise they are never exported.
          this.adoptPendingFiles(application.sharedFs);
        }
      }),
    );
  }

  /**
   * Moves the files a child environment left pending to this environment's mem-fs, so that they are committed
   * (exported) with the rest of the workspace.
   */
  private adoptPendingFiles(childFs: MemFs<MemFsEditorFile>) {
    childFs.each(file => {
      if (isFilePending(file)) {
        this.env.sharedFs.add(file);
      }
    });
  }

  /**
   * Writes the json files of the jdl, merged with the files written before: a `.yo-rc.json` keeps the config the jdl does
   * not set, an entity keeps its changelog date; the files of an application with its own in-memory file system go to it.
   * The applications config is left out with ignoreApplication, the deployments config with ignoreDeployments.
   */
  writeJDLFiles() {
    const sharedFsByFolder = new Map(this.applications.filter(app => app.sharedFs).map(app => [app.folder, app.sharedFs!]));
    for (const [path, content] of Object.entries(this.files)) {
      const isYoRc = path === '.yo-rc.json' || path.endsWith('/.yo-rc.json');
      if (isYoRc && (isDeploymentConfig(content) ? this.ignoreDeployments : this.ignoreApplication)) continue;
      const sharedFs = sharedFsByFolder.get(path.includes('/') ? path.slice(0, path.indexOf('/')) : '');
      const fs: MemFsEditor = sharedFs ? createMemFsEditor(sharedFs) : this.fs;
      const file = this.destinationPath(path);
      if (isYoRc) {
        fs.writeJSON(file, mergeYoRcContent(fs.readJSON(file, {}) as YoRcFileContent, content as YoRcFileContent));
      } else {
        const oldConfig: any = fs.readJSON(file, {});
        // An entity written before keeps its changelog date, which the jdl may not set.
        const changelogDate = content.annotations?.changelogDate ?? oldConfig.annotations?.changelogDate;
        const annotations = changelogDate ? { ...content.annotations, changelogDate } : content.annotations;
        fs.writeJSON(file, { ...oldConfig, ...content, ...(annotations ? { annotations } : {}) });
      }
    }
  }
}
