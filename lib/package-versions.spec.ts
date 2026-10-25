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
import { describe, expect, it } from 'expect-node';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getPackageVersions, toGitInstall } from './package-versions.ts';

const commit = '0123456789abcdef0123456789abcdef01234567';

const createPackage = (files: Record<string, unknown>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'package-versions-')));
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(contents));
  }
  return root;
};

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

describe('lib > package-versions', () => {
  describe('toGitInstall', () => {
    it.each([
      ['https://github.com/jhipster/generator-jhipster-nodejs.git', 'github:jhipster/generator-jhipster-nodejs'],
      ['git@github.com:jhipster/generator-jhipster-nodejs.git', 'github:jhipster/generator-jhipster-nodejs'],
      ['git+https://github.com/jhipster/generator-jhipster-nodejs.git', 'github:jhipster/generator-jhipster-nodejs'],
      ['jhipster/generator-jhipster-nodejs', 'github:jhipster/generator-jhipster-nodejs'],
      ['https://gitlab.com/owner/repo.git', 'git+https://gitlab.com/owner/repo.git'],
      ['git@gitlab.com:owner/repo.git', 'git+ssh://git@gitlab.com/owner/repo.git'],
    ])('should give the install of %s at a commit', (url, install) => {
      expect(toGitInstall(url, commit)).toBe(`${install}#${commit}`);
    });
  });

  describe('getPackageVersions', () => {
    it('should give the version of a published package alone', () => {
      const root = createPackage({ 'package.json': { name: 'generator-jhipster-foo', version: '1.2.3' } });
      expect(getPackageVersions(root, { name: 'generator-jhipster-foo' })).toEqual({ version: '1.2.3', install: undefined });
    });

    it('should give the version of build-info.json and the npm alias of a package published under another name', () => {
      const root = createPackage({
        'package.json': { name: '@scope/generator-jhipster', version: '0.0.6' },
        'build-info.json': { version: '9.5.0-next.0', commit },
      });
      expect(getPackageVersions(root, { name: 'generator-jhipster' })).toEqual({
        version: '9.5.0-next.0',
        install: 'npm:@scope/generator-jhipster@0.0.6',
      });
    });

    it('should give the git reference of a package installed from git', () => {
      const root = createPackage({
        'package.json': { name: 'generator-jhipster-foo', version: '1.2.3', repository: 'github:owner/generator-jhipster-foo' },
        'dist/build-info.json': { commit },
      });
      expect(getPackageVersions(root, { name: 'generator-jhipster-foo' })).toEqual({
        version: '1.2.3',
        install: `github:owner/generator-jhipster-foo#${commit}`,
      });
    });

    const createCheckout = (name: string) => {
      const root = createPackage({ 'package.json': { name, version: '1.2.3' } });
      git(root, 'init', '-q');
      git(root, 'remote', 'add', 'origin', `https://github.com/owner/${name}.git`);
      git(root, 'remote', 'add', 'upstream', `https://github.com/upstream/${name}.git`);
      git(root, 'add', '.');
      git(root, '-c', 'user.name=test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'init');
      return { root, head: git(root, 'rev-parse', 'HEAD') };
    };

    it('should give the git reference of a checkout at the remote that has its commit, origin first', () => {
      const { root, head } = createCheckout('generator-jhipster-foo');
      git(root, 'update-ref', 'refs/remotes/upstream/main', head);
      expect(getPackageVersions(root, { name: 'generator-jhipster-foo' })).toEqual({
        version: '1.2.3',
        install: `github:upstream/generator-jhipster-foo#${head}`,
      });

      git(root, 'update-ref', 'refs/remotes/origin/main', head);
      // Another name, not cached.
      expect(getPackageVersions(root, { name: 'generator-jhipster-foo-origin' })).toEqual({
        version: '1.2.3',
        install: `github:owner/generator-jhipster-foo#${head}`,
      });
    });

    it('should give the path of a checkout whose commit no remote has', () => {
      const { root } = createCheckout('generator-jhipster-unpushed');
      expect(getPackageVersions(root, { name: 'generator-jhipster-unpushed' })).toEqual({ version: '1.2.3', install: root });
    });

    it('should give the path of a checkout with uncommitted changes', () => {
      const { root, head } = createCheckout('generator-jhipster-changed');
      git(root, 'update-ref', 'refs/remotes/origin/main', head);
      writeFileSync(join(root, 'changed.txt'), 'changed');
      expect(getPackageVersions(root, { name: 'generator-jhipster-changed' })).toEqual({ version: '1.2.3', install: root });
    });
  });
});
