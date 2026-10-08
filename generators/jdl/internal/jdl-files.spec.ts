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
import { beforeEach, describe, expect, it } from 'esmocha';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { create as createMemFs } from 'mem-fs';
import { type MemFsEditor, create as createMemFsEditor } from 'mem-fs-editor';

import { defaultHelpers as helpers } from '../../../lib/testing/index.ts';

import { readJDLJsonFiles } from './jdl-files.ts';

const writeOnDisk = (root: string, files: Record<string, unknown>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(content));
  }
};

describe('generator - jdl - readJDLJsonFiles', () => {
  let root: string;
  let fs: MemFsEditor;

  beforeEach(async () => {
    await helpers.prepareTemporaryDir();
    root = process.cwd();
    fs = createMemFsEditor(createMemFs());
  });

  it('should read the application of the folder from the disk and from the memory', () => {
    writeOnDisk(root, { '.yo-rc.json': { 'generator-jhipster': { baseName: 'jhipster' } }, '.jhipster/Foo.json': { name: 'Foo' } });
    fs.writeJSON(join(root, '.jhipster/Bar.json'), { fields: [] });
    expect(readJDLJsonFiles(fs, root)).toEqual({
      '.jhipster/Bar.json': { name: 'Bar', fields: [] },
      '.jhipster/Foo.json': { name: 'Foo' },
      '.yo-rc.json': { 'generator-jhipster': { baseName: 'jhipster' } },
    });
  });

  it('should leave out a file deleted in memory and take the content written in memory', () => {
    writeOnDisk(root, { '.yo-rc.json': { 'generator-jhipster': { baseName: 'jhipster' } }, '.jhipster/Foo.json': { name: 'Foo' } });
    fs.delete(join(root, '.jhipster/Foo.json'));
    fs.writeJSON(join(root, '.yo-rc.json'), { 'generator-jhipster': { baseName: 'changed' } });
    expect(readJDLJsonFiles(fs, root)).toEqual({ '.yo-rc.json': { 'generator-jhipster': { baseName: 'changed' } } });
  });

  it('should read the applications of the folders without an application in the folder', () => {
    writeOnDisk(root, {
      'app1/.yo-rc.json': { 'generator-jhipster': { baseName: 'app1' } },
      'app1/.jhipster/Foo.json': { name: 'Foo' },
      'other/.jhipster/Bar.json': { name: 'Bar' },
    });
    fs.writeJSON(join(root, 'app2/.yo-rc.json'), { 'generator-jhipster': { baseName: 'app2' } });
    expect(Object.keys(readJDLJsonFiles(fs, root))).toEqual(['app1/.jhipster/Foo.json', 'app1/.yo-rc.json', 'app2/.yo-rc.json']);
  });

  it('should read only the application of the folder when it has one', () => {
    writeOnDisk(root, { '.yo-rc.json': { 'generator-jhipster': { baseName: 'root' } }, 'app1/.yo-rc.json': { 'generator-jhipster': {} } });
    expect(Object.keys(readJDLJsonFiles(fs, root))).toEqual(['.yo-rc.json']);
  });
});
