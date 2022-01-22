/**
 * Copyright 2013-2022 the original author or authors from the JHipster project.
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

import chalk from 'chalk';
import { readFile, rm, rmdir, unlink, readdir, stat } from 'fs/promises';
import libexec from 'libnpmexec';
import semver from 'semver';
import gitignore from 'parse-gitignore';
import path from 'path';
import latestVersion from 'latest-version';
import ora from 'ora';
import untildify from 'untildify';
import { filter } from 'p-transform';

import {
  PRIORITY_PREFIX,
  INITIALIZING_PRIORITY,
  CONFIGURING_PRIORITY,
  PREPARING_PRIORITY,
  DEFAULT_PRIORITY,
  WRITING_PRIORITY,
  POST_WRITING_PRIORITY,
  INSTALL_PRIORITY,
  END_PRIORITY,
} from '../../lib/constants/priorities.mjs';
import BaseGenerator from '../generator-base.js';

import constants from '../generator-constants.js';
import statistics from '../statistics.js';
import { parseBluePrints } from '../../utils/blueprint.js';

const { SERVER_MAIN_RES_DIR } = constants;

/* Constants used throughout */
const GENERATOR_JHIPSTER = 'generator-jhipster';
const DEFAULT_CLI_OPTIONS = '--with-entities --force --skip-install --skip-git --ignore-errors --no-insight'.split(' ');
const GIT_VERSION_NOT_ALLOW_MERGE_UNRELATED_HISTORIES = '2.9.0';

const MIGRATE_BRANCH = 'jhipster_migrate';
const MIGRATE_GLOBAL_VERSION = 'global';
const MIGRATE_LOCAL_VERSION = 'local';
const MIGRATE_TMP_FOLDER = '.jhipster-migrate';
const MIGRATE_CONFIG_FILE = `${MIGRATE_TMP_FOLDER}/config.json`;

const JSON_DRIVER_GIT_CONFIG = {
  'core.attributesfile': untildify('~/.gitattributes'),
  'merge.json.driver': 'npx --yes git-json-merge %A %O %B',
  'merge.json.name': 'custom merge driver for json files',
};

const rmCompat =
  rm ||
  (async (file, options) => {
    try {
      await rmdir(file, options);
    } catch (error) {
      await unlink(file);
    }
  });

export default class extends BaseGenerator {
  constructor(args, opts, features) {
    super(args, opts, { taskPrefix: PRIORITY_PREFIX, unique: 'namespace', ...features });

    // This adds support for a `--target-version` flag
    this.option('target-version', {
      desc: 'Migrate to a specific JHipster version instead of the latest',
      type: String,
    });

    // This adds support for a `--target-blueprint-versions` flag
    this.option('target-blueprints', {
      desc: 'Migrate to specific blueprint versions instead of the latest, e.g. --target-blueprint-versions foo@0.0.1,bar@1.0.2',
      type: String,
    });

    this.option('target-cli-options', {
      desc: 'Migrate to a custom generation cli option',
      type: String,
    });

    // This adds support for a `--skip-install` flag
    this.option('skip-install', {
      desc: 'Skips installing dependencies during the migration process',
      type: Boolean,
      defaults: false,
    });

    // This adds support for a `--silent` flag
    this.option('silent', {
      desc: 'Hides output of the generation process',
      type: Boolean,
      defaults: true,
    });

    // This adds support for a `--skip-checks` flag
    this.option('skip-checks', {
      desc: 'Disable checks during project regeneration',
      type: Boolean,
      defaults: false,
    });

    this.option('cli', {
      desc: 'Cli to use',
      type: String,
    });

    this.option('write-migrate-config', {
      desc: 'Write migrate configuration to disk',
      type: Boolean,
      defaults: false,
    });

    if (this.options.help) {
      return;
    }

    if (!this.config.existed) {
      throw new Error(
        "Could not find a valid JHipster application configuration, check if the '.yo-rc.json' file exists and if the 'generator-jhipster' key exists inside it."
      );
    }

    this.parseCommonRuntimeOptions();

    this.migrateStorage = this.createStorage(MIGRATE_CONFIG_FILE);
    this.migrateConfig = this.migrateStorage.createProxy();
    this.migrateSourceStorage = this.migrateStorage.createStorage('source');
    this.migrateTargetStorage = this.migrateStorage.createStorage('target');

    const { targetCliOptions, cli } = this.options;
    if (targetCliOptions !== undefined) {
      this.migrateTargetStorage.set('cliOptions', targetCliOptions.split(' ').filter(Boolean));
    }
    if (cli !== undefined) {
      this.migrateConfig.cli = cli;
    }
    if (this.options.silent) {
      this.spawnCommandOptions = { stdio: 'ignore' };
    }
  }

  get [INITIALIZING_PRIORITY]() {
    return {
      validateFromCli() {
        this.checkInvocationFromCLI();
      },

      displayLogo() {
        this.log(chalk.green('Welcome to the JHipster Migrate Sub-Generator'));
        this.log(chalk.green('This will help migrate your current application codebase'));
      },

      assertJHipsterProject() {
        if (!this.config.get('baseName')) {
          throw new Error('Current directory does not contain a JHipster project.');
        }
      },

      async assertGitPresent() {
        if (!(await this.checkGitVersion())) {
          this.warning('git is not found on your computer.\n', ` Install git: ${chalk.yellow('https://git-scm.com/')}`);
          throw new Error('Exiting the process.');
        }
      },

      async parseOptions() {
        const { targetVersion } = this.options;
        const globalJHipster = targetVersion === MIGRATE_GLOBAL_VERSION;
        const localJHipster = targetVersion === MIGRATE_LOCAL_VERSION;
        const changeConfig = globalJHipster || localJHipster;

        const cliOptions = [...DEFAULT_CLI_OPTIONS, ...(this.options.skipChecks ? ['--skip-checks'] : [])];
        let targetJHipsterVersion;
        if (globalJHipster) {
          targetJHipsterVersion = JSON.parse(await readFile(new URL('../../package.json', import.meta.url))).version;
        } else if (localJHipster) {
          targetJHipsterVersion = this.jhipsterConfig.jhipsterVersion;
        } else {
          targetJHipsterVersion = targetVersion;
        }
        const sharedVersion = changeConfig ? targetJHipsterVersion || this.jhipsterConfig.jhipsterVersion : undefined;

        const blueprints = parseBluePrints(this.options.blueprints || this.config.get('blueprints') || this.config.get('blueprint')) || [];
        const passedTargetBlueprints = parseBluePrints(this.options.targetBlueprints);
        passedTargetBlueprints.forEach(passedBlueprint => {
          const blueprint = blueprints.find(blueprint => blueprint.name === passedBlueprint.name);
          if (blueprint) {
            blueprint.targetVersion = passedBlueprint.version;
          } else {
            blueprints.push({ name: passedBlueprint.name, targetVersion: passedBlueprint.version, new: true });
          }
        });

        this.migrateStorage.defaults({
          globalJHipster,
          localJHipster,
          migrateBranch: MIGRATE_BRANCH,
          changeConfig,
          blueprints,
          cli: 'jhipster',
          cliOptions,
        });

        this.migrateSourceStorage.defaults({
          jhipsterVersion: sharedVersion || this.jhipsterConfig.jhipsterVersion,
        });

        this.migrateTargetStorage.defaults({
          jhipsterVersion: sharedVersion || targetJHipsterVersion,
        });
      },
    };
  }

  get [CONFIGURING_PRIORITY]() {
    return {
      async checkLatestBlueprintVersions() {
        const { blueprints } = this.migrateConfig;
        if (!blueprints || blueprints.length === 0) {
          this.log('No blueprints detected, skipping check of last blueprint version');
          return;
        }

        this.success('Checking for new blueprint versions');
        await Promise.all(
          blueprints
            .filter(blueprint => !blueprint.targetVersion)
            .map(async blueprint => {
              blueprint.targetVersion = await latestVersion(blueprint.name);
              if (blueprint.new || semver.lt(blueprint.version, blueprint.targetVersion)) {
                this.newBlueprintVersionFound = true;
                this.success(`New ${blueprint.name} version found: ${blueprint.targetVersion}`);
              } else {
                this.warning(
                  `${chalk.green('No update available.')} Application has already been generated with latest version for blueprint: ${
                    blueprint.name
                  }`
                );
              }
              this.success(`Done checking for new version for blueprint ${blueprint.name}@${blueprint.targetVersion}`);
            })
        );
        this.migrateStorage.set('blueprints', blueprints);
        this.success('Done checking for new version of blueprints');
      },

      async checkLatestJhipsterVersion() {
        const {
          source: { jhipsterVersion: sourceJHipsterVersion },
          target: { jhipsterVersion: targetJHipsterVersion },
        } = this.migrateConfig;

        // Target jhipster version is set, no check is needed.
        if (targetJHipsterVersion) return;

        const latestJHipsterVersion = await latestVersion(GENERATOR_JHIPSTER);
        if (semver.lt(sourceJHipsterVersion, latestJHipsterVersion)) {
          this.success(`New ${GENERATOR_JHIPSTER} version found: ${latestJHipsterVersion}`);
        } else if (this.options.force) {
          this.log(chalk.yellow('Forced re-generation'));
        } else if (!this.newBlueprintVersionFound) {
          throw new Error(`${chalk.green('No update available.')} Application has already been generated with latest version.`);
        }

        this.migrateTargetStorage.set('jhipsterVersion', latestJHipsterVersion);
      },

      async assertGitRepository() {
        const git = this.createGit();
        if (!(await git.checkIsRepo())) {
          await git.init().add('.').commit('Initial', ['--allow-empty', '--no-verify']);
        }
      },

      async assertNoLocalChanges() {
        const result = await this.createGit().status();
        if (!result.isClean()) {
          this.warning(result.files.map(file => `${file.index} ${file.path}`));
          throw new Error(' local changes found.\n\tPlease commit/stash them before upgrading');
        }
      },

      async detectCurrentBranch() {
        this.migrateSourceStorage.set('branch', await this.createGit().revparse(['--abbrev-ref', 'HEAD']));
      },
    };
  }

  get [PREPARING_PRIORITY]() {
    return {
      async setupJsonDriver() {
        const git = this.createGit();
        if (
          (await git.getConfig('merge.json.driver')).value &&
          (await git.raw(['check-attr', 'merge', 'package.json'])).trim().endsWith('json')
        ) {
          this.log.ok(`${chalk.green('git-json-merge')} already set up`);
          return;
        }

        this.log(`
${chalk.green('git-json-merge')} is recommended to merge ${chalk.green(
          'package.json'
        )}. The following will be added to your global git configuration.
  ${Object.entries(JSON_DRIVER_GIT_CONFIG)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n  ')}

And ${chalk.green('~/.gitattributes')} will be created with:
  *.json merge=json

For more information see https://github.com/jonatanpedersen/git-json-merge.
`);
        const result = await this.prompt([
          {
            type: 'confirm',
            name: 'setupJsonDriver',
            message: `Do you want to setup ${chalk.green('git-json-merge')}?`,
            default: true,
          },
        ]);

        if (!result.setupJsonDriver) {
          this.log.error(`${chalk.green('git-json-merge')} ignored`);
          return;
        }

        const cleanup = [];
        for (const [key, value] of Object.entries(JSON_DRIVER_GIT_CONFIG)) {
          if (!(await git.getConfig(key)).value) {
            await git.addConfig(key, value, false, 'global');
            cleanup.push(`git config --global --unset ${key}`);
          }
        }

        if ((await git.raw(['check-attr', 'merge', 'package.json'])).includes('unspecified')) {
          const gitattributesFile = (await git.getConfig('core.attributesfile')).value;
          const exists = this.fs.exists(gitattributesFile);
          this.fs.append(gitattributesFile, '*.json merge=json', { create: true });
          await this.env.commitSharedFs(this.env.sharedFs.stream().pipe(filter(file => file.path === gitattributesFile)));
          cleanup.push(exists ? `rm ${gitattributesFile}` : `Remove '*.json merge=json' line from ${gitattributesFile}`);
        }
        this.log.ok('git-json-merge set up');
        this.log(`
To cleanup ${chalk.green('git-json-merge')} run:
  ${cleanup.join('\n  ')}
`);
      },
      async prepareMigrateBranch() {
        const {
          globalJHipster,
          localJHipster,
          migrateBranch,
          blueprints,
          cliOptions: defaultCliOptions,
          source: { jhipsterVersion, branch: sourceBranch, cliOptions: sourceCliOptions = [] },
        } = this.migrateConfig;

        const git = this.createGit();
        try {
          // Check if migrate branch exists.
          await git.revparse(['--verify', migrateBranch]);
        } catch (error) {
          // Create and checkout migrate branch
          await git.checkout(['--orphan', migrateBranch]);
          this.success(`Created branch ${migrateBranch}`);

          // Remove/rename old files
          await this.cleanUp();

          const regenerateBlueprints = blueprints
            .filter(blueprint => !blueprint.new)
            .map(blueprint => ({ name: blueprint.name, version: blueprint.version }));
          const cliOptions = [...defaultCliOptions, ...sourceCliOptions];

          // Regenerate the project
          await this.regenerate({
            jhipsterVersion,
            localJHipster,
            globalJHipster,
            blueprints: regenerateBlueprints,
            type: 'initial',
            cliOptions,
          });

          const mergeOptions = ['--strategy', 'ours', migrateBranch, '-m', `Initial merge of ${migrateBranch} branch into application`];
          if (await this.checkGitVersion(GIT_VERSION_NOT_ALLOW_MERGE_UNRELATED_HISTORIES)) {
            mergeOptions.push('--allow-unrelated-histories');
          }

          await git
            // Checkout original branch
            .checkout(sourceBranch)
            // Register reference for merging
            .merge(mergeOptions);
          this.success(`Merged ${migrateBranch} into ${sourceBranch}`);
        }
      },
    };
  }

  get [DEFAULT_PRIORITY]() {
    return {
      insight() {
        statistics.sendSubGenEvent('generator', 'migrate');
      },

      async generateWithTargetVersion() {
        const {
          globalJHipster,
          localJHipster,
          blueprints,
          cliOptions: defaultCliOptions,
          changeConfig,
          migrateBranch,
          target: { jhipsterVersion, cliOptions: targetCliOptions = [] },
        } = this.migrateConfig;

        await this.createGit().checkout(migrateBranch);

        const regenerateBlueprints = blueprints.map(blueprint => ({
          name: blueprint.name,
          version: blueprint.targetVersion,
          new: blueprint.new,
        }));
        const cliOptions = [...defaultCliOptions, ...targetCliOptions];

        await this.regenerate({
          jhipsterVersion,
          localJHipster,
          globalJHipster,
          blueprints: regenerateBlueprints,
          type: changeConfig ? 'change' : 'upgrade',
          cliOptions,
        });
      },
    };
  }

  get [WRITING_PRIORITY]() {
    return {
      async mergeChangesBack() {
        const {
          migrateBranch,
          source: { branch: sourceBranch },
        } = this.migrateConfig;
        const spinner = ora(`Merging changes back to ${sourceBranch}`).start();

        try {
          await this.createGit()
            .checkout(sourceBranch, ['-f'])
            .merge([migrateBranch, '-m', `Merging ${migrateBranch} into application`]);
          spinner.succeed('Migration patch applied');
        } catch (error) {
          spinner.fail(error.message);
          this.skipInstall = true;
        }
      },
    };
  }

  get [POST_WRITING_PRIORITY]() {
    return {
      removeMigrateConfig() {
        if (!this.options.writeMigrateConfig) {
          this.fs.delete(MIGRATE_CONFIG_FILE);
        }
      },
    };
  }

  get [INSTALL_PRIORITY]() {
    return {
      install() {
        if (!this.options.skipInstall && !this.install) {
          this.log('Installing dependencies, please wait...');
          this.spawnCommandSync('npm', ['install']);
        }
      },
    };
  }

  get [END_PRIORITY]() {
    return {
      async end() {
        const diff = await this.createGit().diff(['--name-only', '--diff-filter', 'U']);
        this.success(chalk.bold('Migrated successfully.'));
        if (diff) {
          this.warning(`Please fix conflicts listed below and commit!\n${diff}`);
        }
      },
    };
  }

  async rmRf(file) {
    const absolutePath = path.resolve(file);
    if (!this.options.silent) {
      this.info(`Removing ${absolutePath}`);
    }
    try {
      await rmCompat(absolutePath, { recursive: true });
      // eslint-disable-next-line no-empty
    } catch (error) {}
  }

  /**
   * Remove every generated file not related to the generation.
   */
  async cleanUp() {
    const ignoredFiles = gitignore(await readFile('.gitignore'));
    const filesToKeep = ['.yo-rc.json', '.jhipster', 'node_modules', '.git', ...ignoredFiles];
    (await readdir(this.destinationPath())).forEach(file => {
      if (!filesToKeep.includes(file)) {
        this.rmRf(file);
      }
    });
    this.success('Cleaned up project directory');
  }

  async regenerate({ globalJHipster, localJHipster, jhipsterVersion, blueprints, type, cliOptions }) {
    const { cli } = this.migrateConfig;
    const spinner = this.options.silent ? ora(`Regenerating ${chalk.yellow(type)} application`).start() : undefined;
    this.debug(`${cli} ${cliOptions.join(' ')}`);
    const blueprintInfo = blueprints.length > 0 ? ` and ${blueprints.map(bp => `${bp.name}@${bp.version}`).join(', ')} ` : '';
    const message = `JHipster ${globalJHipster ? 'GLOBAL ' : ''}${jhipsterVersion}${blueprintInfo}`;

    try {
      if (globalJHipster) {
        await this.spawnCommand(cli, cliOptions, this.spawnCommandOptions);
      } else if (localJHipster && (await stat('node_modules')) && !blueprints.find(blueprint => blueprint.new)) {
        await this.spawnCommand('npm', ['install'], this.spawnCommandOptions);
        await this.spawnCommand('npx', ['--no', 'jhipster', ...cliOptions, '--prefer-local'], this.spawnCommandOptions);
      } else {
        // Install packages using npx
        await libexec({
          yes: true,
          npxCache: `${MIGRATE_TMP_FOLDER}/npx`,
          call: `${cli} ${[...cliOptions, '--prefer-global'].join(' ')}`,
          localBin: null,
          globalBin: null,
          path: null,
          packages: [`${GENERATOR_JHIPSTER}@${jhipsterVersion}`, ...blueprints.map(({ name, version }) => `${name}@${version}`)],
          stdio: 'ignore',
        });
      }

      const keystore = `${SERVER_MAIN_RES_DIR}config/tls/keystore.p12`;
      this.rmRf(keystore);
      await this.createGit()
        .add(['.', '--', `:!${MIGRATE_TMP_FOLDER}`])
        .commit(`Migration application generated with ${message} (${type})`, ['--allow-empty', '--no-verify']);

      spinner && spinner.succeed(`Successfully regenerated ${chalk.yellow(type)} application using ${message}`);
    } catch (error) {
      spinner && spinner.fail(`Fail to regenerate ${chalk.yellow(type)} application using ${message}`);
      throw error;
    }
  }
}
