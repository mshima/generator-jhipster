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

import { basename, dirname, join } from 'node:path';

import rawPackageJson from '../package.json' with { type: 'json' };

import { readBuildInfo } from './build-info.ts';

export const isDistFolder = () => basename(dirname(import.meta.dirname)) === 'dist';

export const getPackageRoot = (relativePath?: string) => {
  const sourceRoot = dirname(import.meta.dirname);
  const packageDirectory = isDistFolder() ? dirname(sourceRoot) : sourceRoot;
  return relativePath ? join(packageDirectory, relativePath) : packageDirectory;
};

export const getSourceRoot = (relativePath?: string) => {
  const sourceRoot = dirname(import.meta.dirname);
  return relativePath ? join(sourceRoot, relativePath) : sourceRoot;
};

/**
 * The package.json of generator-jhipster, its version the one of JHipster: the version of its `build-info.json` when it has
 * one (in dist, or at the root of the sources), like a build published under another name and another version.
 */
const buildVersion = readBuildInfo(getSourceRoot())?.version;
export const packageJson: typeof rawPackageJson = buildVersion ? { ...rawPackageJson, version: buildVersion } : rawPackageJson;
