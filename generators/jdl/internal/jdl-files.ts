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
import { basename, dirname, posix, relative, resolve } from 'node:path';

import type { MemFsEditor } from 'mem-fs-editor';
import { Minimatch } from 'minimatch';
import { globSync, isDynamicPattern } from 'tinyglobby';

import { JHIPSTER_CONFIG_DIR, YO_RC_FILE } from '../../generator-constants.ts';

import type { JDLJsonFiles } from './jdl-parser.ts';

/** The json files of applications a jdl is written from: the ones of the folder, and the ones of its folders. */
const JSON_FILES_PATTERNS = [YO_RC_FILE, `${JHIPSTER_CONFIG_DIR}/*.json`, `*/${YO_RC_FILE}`, `*/${JHIPSTER_CONFIG_DIR}/*.json`];

const normalize = (filePath: string) => filePath.replaceAll('\\', '/');

/**
 * The files of a folder matching glob patterns, as mem-fs-editor's `copy` finds them: the ones of the disk and the ones of
 * the in-memory file system, the files written and not committed yet, without the deleted ones. Absolute paths.
 */
const globFiles = (fs: MemFsEditor, root: string, patterns: string[]): string[] => {
  const found = globSync(patterns, { cwd: root, dot: true, absolute: true, onlyFiles: true }).map(filePath => resolve(filePath));
  const matchers = patterns.map(pattern => new Minimatch(posix.join(normalize(root), pattern), { dot: true }));
  const inMemory = fs.store
    .all()
    .filter(file => fs.exists(file.path))
    .map(file => resolve(file.path))
    .filter(filePath => !found.includes(filePath))
    // The store may have a glob path, which is no real file.
    .filter(filePath => !isDynamicPattern(normalize(filePath)))
    .filter(filePath => matchers.some(matcher => matcher.match(normalize(filePath))));
  // A file deleted in memory is still on the disk.
  return [...found, ...inMemory].filter(filePath => fs.exists(filePath));
};

/**
 * The `.yo-rc.json` and `.jhipster/*.json` files of the applications of a folder, by path relative to it, as jdl-parser's
 * `filesToAst` takes them: the application of the folder, else the applications of its folders. The files are looked up on
 * the disk and in the in-memory file system (see `globFiles`). An entity of an old application without a name takes the
 * one of its file.
 */
export const readJDLJsonFiles = (fs: MemFsEditor, root: string): JDLJsonFiles => {
  const files: JDLJsonFiles = {};
  for (const filePath of globFiles(fs, root, JSON_FILES_PATTERNS)) {
    const path = normalize(relative(root, filePath));
    const content = fs.readJSON(filePath) as Record<string, any> | undefined;
    if (content) {
      files[path] = dirname(path).endsWith(JHIPSTER_CONFIG_DIR) ? { name: basename(path, '.json'), ...content } : content;
    }
  }
  // The application of the folder, else the ones of its folders holding a .yo-rc.json.
  const folders = YO_RC_FILE in files ? [''] : Object.keys(files).flatMap(path => (basename(path) === YO_RC_FILE ? [dirname(path)] : []));
  const inFolder = (path: string) =>
    folders.some(folder => (folder ? path.startsWith(`${folder}/`) : path === YO_RC_FILE || path.startsWith(`${JHIPSTER_CONFIG_DIR}/`)));
  return Object.fromEntries(
    Object.entries(files)
      .filter(([path]) => inFolder(path))
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
};
