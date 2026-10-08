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
import { resetFileState } from 'mem-fs-editor/state';
import { Minimatch } from 'minimatch';

import type { JDLApplicationConfig, JDLDefinitions } from '../../../lib/jdl/core/parsing/types/parsing.ts';
import { mergeYoRcContent } from '../../../lib/utils/yo-rc.ts';
import { GENERATOR_JHIPSTER } from '../../generator-constants.ts';
import { resolveJDLDefinitions } from '../internal/jdl-definitions.ts';
import { convertJDL, createJDLParserRuntime } from '../internal/jdl-parser.ts';

/**
 * The root `.yo-rc.json` of the files of the jdl store, the parent of the folder of its application: the jdl as written
 * and the files written from it, in memory only.
 */
export const jdlStoreRootYoRcPath = (destinationPath: string) => join(destinationPath, '..', '.yo-rc.json');

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

    const jdlStoreContents = jdlStoreFileInMemory?.contents ?? loadFile(jdlStorePath).contents;
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
    const { ast, files: jdlFiles, rootYoRc } = convertJDL(
      jdlStoreContents.toString(),
      createJDLParserRuntime(resolveJDLDefinitions({ jdlDefinitions, jdlDefinition })),
    );
    const applications = ast.body.filter(statement => statement.type === 'Application').length;
    if (applications !== 1) {
      throw new Error(`JDL store supports only jdls with 1 application, found ${applications}`);
    }

    // The files of the application, the ones of the destination, without the deployments.
    for (const [path, content] of Object.entries(jdlFiles)) {
      if (content[GENERATOR_JHIPSTER]?.deploymentType) continue;
      const filePath = join(destinationPath, path);
      const file = loadFile(filePath) as MemFsEditorFile;
      if (filePath === yoRcFilePath) {
        const yoRcContents = yoRcFileInMemory?.contents ?? file.contents;
        file.contents = Buffer.from(
          JSON.stringify(mergeYoRcContent(yoRcContents ? JSON.parse(yoRcContents.toString()) : {}, content), null, 2),
        );
      } else {
        file.contents = Buffer.from(JSON.stringify(content, null, 2));
      }
      yield file;
    }

    // The jdl as written, for the export to merge the application into: in memory only, it is never committed.
    if (rootYoRc) {
      const rootYoRcFile = loadFile(jdlStoreRootYoRcPath(destinationPath)) as MemFsEditorFile;
      rootYoRcFile.contents = Buffer.from(JSON.stringify(rootYoRc, null, 2));
      resetFileState(rootYoRcFile);
      yield rootYoRcFile;
    }
  });
