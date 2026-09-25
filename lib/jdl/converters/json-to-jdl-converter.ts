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

import fs from 'node:fs';
import path from 'node:path';

import type { YoRcFileContent } from '../../constants/yeoman.ts';
import type { YoRcJHipsterApplicationConfigValue, YoRcJHipsterApplicationContent } from '../../jhipster/types/yo-rc.ts';
import { removeFieldsWithNullishValues } from '../../utils/object.ts';
import { YO_RC_CONFIG_KEY, readEntityFile, readYoRcFile } from '../../utils/yo-rc.ts';
import type { JDLRuntime } from '../core/parsing/types/runtime.ts';
import { printJDL } from '../core/printing/print-jdl.ts';
import type { RawJDLJSONApplication } from '../core/types/exporter.ts';
import type { JSONEntity } from '../core/types/json-config.ts';
import { doesDirectoryExist, doesFileExist } from '../core/utils/file-utils.ts';

import { createJDLASTBuilder } from './json-to-jdl-ast.ts';

type JDLASTBuilder = ReturnType<typeof createJDLASTBuilder>;

/**
 * Converts the application of a directory, or the applications of its subdirectories, to a jdl.
 * @param runtime - the runtime of the jdl.
 * @param directory - the directory holding the `.yo-rc.json` file, or the application directories.
 * @param output - the file the jdl is written to, relative to the directory; false to only return it.
 * @returns the jdl, or undefined when the directory holds no application.
 */
export function convertToJDL(runtime: JDLRuntime, directory = '.', output: string | false = 'app.jdl'): string | undefined {
  const builder = createJDLASTBuilder(runtime);
  if (doesFileExist(path.join(directory, '.yo-rc.json'))) {
    addApplication(builder, readYoRcFile(directory), getJSONEntityFiles(directory));
  } else {
    const subDirectories = getSubdirectories(directory);
    if (subDirectories.length === 0) {
      return undefined;
    }
    try {
      for (const subDirectory of subDirectories) {
        const applicationDirectory = path.join(directory, subDirectory);
        addApplication(
          builder,
          readYoRcFile<YoRcJHipsterApplicationConfigValue>(applicationDirectory),
          getJSONEntityFiles(applicationDirectory) ?? new Map(),
        );
      }
    } catch {
      return undefined;
    }
  }
  const jdl = printJDL(builder.build(), runtime);
  if (output) {
    fs.writeFileSync(path.isAbsolute(output) ? output : path.join(directory, output), jdl);
  }
  return jdl;
}

/**
 * Converts an application, its `.yo-rc.json` content and its entities, to a jdl.
 */
export function convertSingleContentToJDL(
  yoRcFileContent: YoRcJHipsterApplicationContent<Record<string, any>>,
  runtime: JDLRuntime,
  entities?: Map<string, JSONEntity>,
): string {
  const builder = createJDLASTBuilder(runtime);
  addApplication(builder, yoRcFileContent, entities);
  return printJDL(builder.build(), runtime);
}

function addApplication(builder: JDLASTBuilder, yoRcFileContent: YoRcJHipsterApplicationContent, entities?: Map<string, JSONEntity>) {
  builder.addApplication(cleanYoRcFileContent(yoRcFileContent)[YO_RC_CONFIG_KEY], entities);
}

function cleanYoRcFileContent(yoRcFileContent: YoRcFileContent): RawJDLJSONApplication {
  yoRcFileContent = structuredClone(yoRcFileContent);
  const blueprints = (yoRcFileContent as YoRcJHipsterApplicationContent)[YO_RC_CONFIG_KEY].blueprints?.map(blueprint => blueprint.name);
  const microfrontends = (yoRcFileContent as YoRcJHipsterApplicationContent)[YO_RC_CONFIG_KEY].microfrontends?.map(
    ({ baseName }) => baseName,
  );
  const result: RawJDLJSONApplication = {
    ...yoRcFileContent,
    [YO_RC_CONFIG_KEY]: removeFieldsWithNullishValues({ ...yoRcFileContent[YO_RC_CONFIG_KEY], blueprints, microfrontends }),
  };
  for (const key of Object.keys(result)) {
    result[key as keyof RawJDLJSONApplication] = removeFieldsWithNullishValues(result[key as keyof RawJDLJSONApplication]!);
  }
  return result;
}

/** The entities of an application, keyed by their names; undefined when it has no `.jhipster` directory. */
function getJSONEntityFiles(applicationDirectory: string): Map<string, JSONEntity> | undefined {
  if (!doesDirectoryExist(path.join(applicationDirectory, '.jhipster'))) {
    return undefined;
  }
  const entities = new Map<string, JSONEntity>();
  fs.readdirSync(path.join(applicationDirectory, '.jhipster')).forEach(file => {
    const entityName = file.slice(0, file.indexOf('.json'));
    try {
      entities.set(entityName, readEntityFile(applicationDirectory, entityName));
    } catch {
      // Not an entity file, not adding
    }
  });
  return entities;
}

function getSubdirectories(rootDirectory: string): string[] {
  return fs.readdirSync(path.join(rootDirectory)).filter(file => doesDirectoryExist(path.join(rootDirectory, file)));
}
