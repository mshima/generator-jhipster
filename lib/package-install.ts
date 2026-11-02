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

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

type PackageJsonLike = {
  name?: string;
  version?: string;
  repository?: string | { url?: string };
  yeoman?: { meta?: { packageVersion?: string } };
};

const readJson = <T>(file: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** A git url as an install spec at a commit: `github:owner/repo#commit` for GitHub, `git+<url>#commit` otherwise. */
export const toGitInstall = (url: string, commit: string): string => {
  const github = /^(?:git\+)?(?:https?:\/\/|ssh:\/\/git@|git@)github\.com[/:]([^/]+\/[^/#]+?)(?:\.git)?(?:#.*)?$/.exec(url);
  if (github) return `github:${github[1]}#${commit}`;
  const shorthand = /^(?:github:)?([\w.-]+\/[\w.-]+)(?:#.*)?$/.exec(url);
  if (shorthand) return `github:${shorthand[1]}#${commit}`;
  const scp = /^([\w.-]+@[\w.-]+):(.+?)(?:#.*)?$/.exec(url);
  const gitUrl = scp ? `ssh://${scp[1]}/${scp[2]}` : url.replace(/^git\+/, '').replace(/#.*$/, '');
  return `git+${gitUrl}#${commit}`;
};

/** Whether an install spec is a git dependency, which npm 12 installs only when its allow-git config allows it. */
export const isGitInstall = (install: string): boolean => /^(?:git\+|git:|github:|gitlab:|bitbucket:|gist:)/.test(install);

/**
 * The npmrc with git dependencies allowed for the package.json of the project (allow-git=root, the workspaces
 * included), unless it sets allow-git itself.
 */
export const allowGitInNpmrc = (npmrc = ''): string =>
  /^\s*allow-git\s*=/m.test(npmrc) ? npmrc : `${npmrc}${npmrc && !npmrc.endsWith('\n') ? '\n' : ''}allow-git=root\n`;

/**
 * The install of a checkout: its commit at a remote that has it (origin first), or its path when it has uncommitted
 * changes or no remote has its commit.
 */
const getCheckoutInstall = (root: string): string | undefined => {
  try {
    if (realpathSync(git(root, 'rev-parse', '--show-toplevel')) !== realpathSync(root)) return undefined;
  } catch {
    return undefined;
  }
  try {
    if (git(root, 'status', '--porcelain') !== '') return root;
    const remotes = git(root, 'for-each-ref', '--contains', 'HEAD', '--format=%(refname:lstrip=2)', 'refs/remotes')
      .split('\n')
      .filter(Boolean)
      .map(ref => ref.split('/')[0]);
    const remote = remotes.includes('origin') ? 'origin' : remotes[0];
    if (!remote) return root;
    return toGitInstall(git(root, 'remote', 'get-url', remote), git(root, 'rev-parse', 'HEAD'));
  } catch {
    return root;
  }
};

const cache = new Map<string, string | undefined>();

/**
 * What to install to generate again with the package at a folder, when it is not its version (the
 * `yeoman.meta.packageVersion` of its package.json, or its `version`): the git reference of a checkout, the npm alias of
 * a package published under another name than `name`, the git reference of a package installed from git (the commit of
 * its `dist/build-info.json` with its repository), the version of the package.json of a package published under another
 * version. Undefined when it is its version.
 */
export const getPackageInstall = (root: string, { name }: { name?: string } = {}): string | undefined => {
  const key = `${root}\0${name}`;
  if (cache.has(key)) return cache.get(key);

  const packageJson = readJson<PackageJsonLike>(join(root, 'package.json')) ?? {};
  const version = packageJson.yeoman?.meta?.packageVersion ?? packageJson.version;

  let install = getCheckoutInstall(root);
  // A package published under another name has the commit it is packed from too: its install is the npm alias.
  if (!install && packageJson.name && packageJson.version && name && packageJson.name !== name) {
    install = `npm:${packageJson.name}@${packageJson.version}`;
  }
  const commit = readJson<{ commit?: string }>(join(root, 'dist', 'build-info.json'))?.commit;
  if (!install && commit) {
    const repository = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url;
    if (repository) install = toGitInstall(repository, commit);
  }
  if (!install && packageJson.version !== version) {
    install = packageJson.version;
  }

  const result = install === version ? undefined : install;
  cache.set(key, result);
  return result;
};
