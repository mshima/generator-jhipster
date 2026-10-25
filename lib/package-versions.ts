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

import { readBuildInfo } from './build-info.ts';

export type PackageVersions = {
  /** The version of the API: the official version, the one compared by the cleanups and the upgrade. */
  version?: string;
  /**
   * What to install to generate again: a git reference of a checkout or of a package installed from git, an npm alias of
   * a package published under another name, or the path of a checkout with uncommitted changes. Undefined when it is the
   * version itself.
   */
  install?: string;
};

type PackageJsonLike = { name?: string; version?: string; repository?: string | { url?: string } };

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

const cache = new Map<string, PackageVersions>();

/**
 * The versions of the package at a folder. The version of the API is the one of its `build-info.json` (at its root or
 * in its dist) when it has one, like a package published under another name and version, the one of its package.json
 * otherwise. The install is the git reference of a checkout, an npm alias when it is published under another name than
 * `name`, the git reference of a package installed from git (the commit of its `build-info.json` with its repository),
 * undefined when it is the version.
 */
export const getPackageVersions = (root: string, { name }: { name?: string } = {}): PackageVersions => {
  const key = `${root}\0${name}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let packageJson: PackageJsonLike = {};
  try {
    packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    // No package.json.
  }
  const buildInfo = { ...readBuildInfo(root), ...readBuildInfo(join(root, 'dist')) };
  const version = buildInfo.version ?? packageJson.version;

  let install = getCheckoutInstall(root);
  // A package published under another name has the commit it is packed from too: its install is the npm alias.
  if (!install && packageJson.name && packageJson.version && name && packageJson.name !== name) {
    install = `npm:${packageJson.name}@${packageJson.version}`;
  }
  if (!install && buildInfo.commit) {
    const repository = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url;
    if (repository) install = toGitInstall(repository, buildInfo.commit);
  }
  if (!install && packageJson.version !== version) {
    install = packageJson.version;
  }

  const versions = { version, install: install === version ? undefined : install };
  cache.set(key, versions);
  return versions;
};
