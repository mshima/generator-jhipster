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

import { join } from 'node:path';
import { Duplex } from 'node:stream';

import { loadFile } from 'mem-fs';
import type { MemFsEditorFile } from 'mem-fs-editor';
import { Minimatch } from 'minimatch';

import { convertJDLToFiles } from '../../../lib/jdl/convert-jdl-to-files.ts';
import type { JDLApplicationConfig, JDLDefinitions } from '../../../lib/jdl/core/parsing/types/parsing.ts';
import { createJDLRuntime } from '../../../lib/jdl-config/jdl-runtime.ts';
import { mergeYoRcContent } from '../../../lib/utils/yo-rc.ts';
import { resolveJDLDefinitions } from '../internal/jdl-definitions.ts';
import { readGenerationTargets, toDestinationFiles } from '../internal/jdl-files.ts';

export const importJDLTransform = ({
  destinationPath,
  jdlStorePath,
  jdlDefinitions,
  jdlDefinition,
}: {
  destinationPath: string;
  jdlStorePath: string;
  /** The definitions of the jdl, the JHipster ones completing those not passed. */
  jdlDefinitions?: Partial<JDLDefinitions>;
  /** @deprecated use `jdlDefinitions`, `{ application: jdlDefinition }` */
  jdlDefinition?: JDLApplicationConfig;
}) =>
  Duplex.from(async function* (files: AsyncGenerator<MemFsEditorFile>) {
    const yoRcFilePath = join(destinationPath, '.yo-rc.json');
    const entitiesFolder = join(destinationPath, '.jhipster');
    const entitiesMatcher = new Minimatch(`${entitiesFolder}/*.json`);
    const entityFields: MemFsEditorFile[] = [];

    let jdlStoreFileInMemory: MemFsEditorFile | undefined;
    let yoRcFileInMemory: MemFsEditorFile | undefined;

    for await (const file of files) {
      if (file.path === jdlStorePath) {
        jdlStoreFileInMemory = file;
        yield jdlStoreFileInMemory;
      } else if (file.path === yoRcFilePath) {
        yoRcFileInMemory = file;
      } else if (entitiesMatcher.match(file.path)) {
        entityFields.push(file);
      } else {
        yield file;
      }
    }

    const jdlStoreContents = jdlStoreFileInMemory?.contents ?? (loadFile(jdlStorePath) as any).contents;
    if (!jdlStoreContents) {
      if (yoRcFileInMemory) {
        yield yoRcFileInMemory;
      }
      for (const file of entityFields) {
        yield file;
      }
      return;
    }
    if (entityFields.length > 0) {
      throw new Error('Entities configuration files are not supported by jdlStore');
    }
    const jdlFiles = convertJDLToFiles(
      jdlStoreContents.toString(),
      createJDLRuntime(resolveJDLDefinitions({ jdlDefinitions, jdlDefinition })),
    );
    const destinationFiles = toDestinationFiles(jdlFiles);
    const { applications } = readGenerationTargets(destinationFiles);
    if (applications.length !== 1) {
      throw new Error(`JDL store supports only jdls with 1 application, found ${applications.length}`);
    }

    // The application config is merged with the one in memory, the deployments config with the one on the disk.
    for (const [path, content] of Object.entries(destinationFiles)) {
      const file = loadFile(join(destinationPath, path)) as MemFsEditorFile;
      if (path === '.yo-rc.json' || path.endsWith('/.yo-rc.json')) {
        const contents = path === '.yo-rc.json' ? (yoRcFileInMemory?.contents ?? file.contents) : file.contents;
        file.contents = Buffer.from(JSON.stringify(mergeYoRcContent(contents ? JSON.parse(contents.toString()) : {}, content), null, 2));
      } else {
        file.contents = Buffer.from(JSON.stringify(content, null, 2));
      }
      yield file;
    }
  });
