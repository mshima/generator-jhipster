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

import { basename, join } from 'node:path';
import { Duplex } from 'node:stream';

import type { ConflicterFile } from '@yeoman/conflicter';
import { filesToAst } from 'jdl-parser/jhipster';
import { loadFile } from 'mem-fs';
import { setModifiedFileState } from 'mem-fs-editor/state';
import { Minimatch } from 'minimatch';

import type { JDLApplicationConfig, JDLDefinitions } from '../../../lib/jdl/core/parsing/types/parsing.ts';
import logger from '../../../lib/jdl/core/utils/objects/logger.ts';
import type { Entity } from '../../../lib/jhipster/types/entity.ts';
import { GENERATOR_JHIPSTER } from '../../generator-constants.ts';
import { resolveJDLDefinitions } from '../internal/jdl-definitions.ts';
import { createJDLParserRuntime } from '../internal/jdl-parser.ts';

import { jdlStoreRootYoRcPath } from './import-jdl-transform.ts';

export const exportJDLTransform = ({
  destinationPath,
  jdlStorePath,
  throwOnMissingConfig = true,
  keepEntitiesConfig,
  jdlDefinitions,
  jdlDefinition,
}: {
  destinationPath: string;
  jdlStorePath: string;
  throwOnMissingConfig?: boolean;
  keepEntitiesConfig?: boolean;
  /** The definitions of the jdl, the JHipster ones completing those not passed. */
  jdlDefinitions?: Partial<JDLDefinitions>;
  /** @deprecated use `jdlDefinitions`, `{ application: jdlDefinition }` */
  jdlDefinition?: JDLApplicationConfig;
}) =>
  Duplex.from(async function* (files: AsyncGenerator<ConflicterFile>) {
    const definitions = resolveJDLDefinitions({ jdlDefinitions, jdlDefinition });
    const yoRcFilePath = join(destinationPath, '.yo-rc.json');
    const rootYoRcFilePath = jdlStoreRootYoRcPath(destinationPath);
    const entitiesMatcher = new Minimatch(`${destinationPath}/.jhipster/*.json`);
    const entitiesFiles: ConflicterFile[] = [];
    const entitiesMap = new Map<string, Entity>();

    let yoRcFileInMemory: ConflicterFile | undefined;
    let jdlStoreFileInMemory: ConflicterFile | undefined;
    let rootYoRc: Record<string, any> | undefined;
    for await (const file of files) {
      if (file.path === rootYoRcFilePath && file.contents) {
        rootYoRc = JSON.parse(file.contents.toString());
      }
      if (file.path === yoRcFilePath) {
        yoRcFileInMemory = file;
      } else if (file.path === jdlStorePath) {
        jdlStoreFileInMemory = file;
      } else if (file.contents && entitiesMatcher.match(file.path)) {
        entitiesMap.set(basename(file.path).replace('.json', ''), JSON.parse(file.contents.toString()));
        entitiesFiles.push(file);
      } else {
        yield file;
      }
    }

    const yoRcFile = loadFile(yoRcFilePath) as ConflicterFile;
    const yoRcContents = yoRcFileInMemory?.contents ?? yoRcFile.contents;
    if (yoRcContents) {
      const contents = JSON.parse(yoRcContents.toString());
      if (contents[GENERATOR_JHIPSTER]?.jdlStore) {
        const { jdlStore, jwtSecretKey, rememberMeKey, jhipsterVersion, creationTimestamp, incrementalChangelog, ...rest } =
          contents[GENERATOR_JHIPSTER];

        // The files of the application written as a jdl, merged into the jdl as written when the import kept it: the files
        // then in the folder of the application, as the import got them.
        const prefix = rootYoRc?.['#jdl'] && rest.baseName ? `${rest.baseName}/` : '';
        const { jdl: jdlContents, errors } = filesToAst(
          {
            ...(prefix ? { '.yo-rc.json': rootYoRc } : {}),
            [`${prefix}.yo-rc.json`]: { ...contents, [GENERATOR_JHIPSTER]: { ...rest, incrementalChangelog } },
            ...Object.fromEntries([...entitiesMap].map(([name, entity]) => [`${prefix}.jhipster/${name}.json`, entity])),
          },
          createJDLParserRuntime(definitions),
        );
        for (const { file, path, message } of errors) {
          logger.warn(`${file}${path.length > 0 ? ` ${path.join('.')}` : ''}: ${message}`);
        }

        const jdlStoreFile = jdlStoreFileInMemory ?? (loadFile(jdlStorePath) as ConflicterFile);
        jdlStoreFile.contents = Buffer.from(jdlContents);
        setModifiedFileState(jdlStoreFile);
        jdlStoreFile.conflicter = 'force';
        yield jdlStoreFile;

        yoRcFile.contents = Buffer.from(
          JSON.stringify({ [GENERATOR_JHIPSTER]: { jdlStore, jwtSecretKey, rememberMeKey, jhipsterVersion, creationTimestamp } }, null, 2),
        );
        setModifiedFileState(yoRcFile);
        yoRcFile.conflicter = 'force';
        yield yoRcFile;

        // Incremental changelog requires entities files to be kept for incremental change at next run
        if (keepEntitiesConfig || incrementalChangelog) {
          for (const file of entitiesFiles) {
            yield file;
          }
        }
      } else if (throwOnMissingConfig) {
        throw new Error(`File ${yoRcFilePath} is not a valid JHipster configuration file`);
      }
    } else if (throwOnMissingConfig) {
      throw new Error(`File ${yoRcFilePath} has no contents`);
    }
  });
