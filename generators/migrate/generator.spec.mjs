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
import assert from 'yeoman-assert';
import expect from 'expect';
import lodash from 'lodash';
import { basename, dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';

import { skipPrettierHelpers as helpers } from '../../test/utils/utils.mjs';
import Generator from './index.mjs';

import testUtils from '../../test/utils/utils.js';
import { escapeRegExp } from '../utils.js';

const { prepareTempDir } = testUtils;

/**
 @return {import('simple-git').SimpleGit}
 */
const createGit = () => simpleGit().env('LANG', 'en');

const { snakeCase } = lodash;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generatorPath = join(__dirname, 'index.mjs');
const generator = basename(__dirname);

describe(`JHipster ${generator} generator`, () => {
  it('generator-list constant matches folder name', async () => {
    await expect((await import('../generator-list.js')).default[`GENERATOR_${snakeCase(generator).toUpperCase()}`]).toBe(generator);
  });
  it('should be exported at package.json', async () => {
    await expect((await import(`generator-jhipster/esm/generators/${generator}`)).default).toBe(Generator);
  });
  it('should support features parameter', () => {
    const instance = new Generator([], { help: true }, { bar: true });
    expect(instance.features.bar).toBe(true);
  });

  describe('default application', () => {
    let cleanup;
    before(async () => {
      cleanup = prepareTempDir();
      await helpers
        .create('jhipster:app', { tmpdir: false })
        .withOptions({
          baseName: 'upgradeTest',
          skipInstall: true,
          skipChecks: true,
          fromCli: true,
          defaults: true,
          localConfig: {
            skipClient: true,
            skipServer: true,
          },
        })
        .run()
        .then(() => {
          return helpers
            .create(generatorPath, { tmpdir: false })
            .withOptions({
              fromCli: true,
              force: true,
              silent: true,
              changeConfig: true,
              cli: join(__dirname, '../../cli/jhipster.js'),
              targetVersion: 'global',
              targetCliOptions: '--skip-commit-hook',
            })
            .run();
        });
    });

    after(() => cleanup());

    it('generated git commits to match snapshot', async () => {
      const git = createGit();
      const log = await git.log();
      const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url)));
      expect(
        log.all
          .map(commit => commit.message)
          .join('\n')
          .replace(new RegExp(escapeRegExp(version), 'g'), 'VERSION')
      ).toMatchInlineSnapshot(`
"=Merging jhipster_migrate into application
Migration application generated with JHipster GLOBAL VERSION (change)
=Initial merge of jhipster_migrate branch into application
Migration application generated with JHipster GLOBAL VERSION (initial)
Initial version of upgradeTest generated by generator-jhipster@VERSION"
`);
    });

    it('generated branches to match snapshot', async () => {
      expect((await createGit().branchLocal()).all).toMatchInlineSnapshot(`
Array [
  "jhipster_migrate",
  "master",
]
`);
    });
    it('generates expected number of commits', async () => {
      // Expecting 5 commits in history (because we used `force` option):
      //   - master: initial commit
      //   - jhipster_upgrade; initial generation
      //   - master: block-merge commit of jhipster_upgrade
      //   - jhipster_upgrade: new generation in jhipster_upgrade
      //   - master: merge commit of jhipster_upgrade
      expect((await createGit().log()).total).toBe(5);
    });
    it('should remove file from updated config', async () => {
      assert.noFile('.lintstagedrc.js');
    });
  });
});
