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

import { before, describe, expect, it } from 'esmocha';
import { globSync } from 'node:fs';
import { join } from 'node:path';

import helpers from 'yeoman-test';

import { getDefaultRuntime } from '../jdl-config/jdl-runtime.ts';

import { convertSingleContentToJDL } from './converters/json-to-jdl-converter.ts';
import { type ImportState, createImporterFromFiles } from './jdl-importer.ts';

/**
 * Golden tests: every jdl of the repository is imported, and the json of each application converted back to jdl,
 * so a rewrite of the converters can be compared with what the current ones produce.
 */
const rootDir = join(import.meta.dirname, '../..');
// The json to jdl converter tests write jdl files among the fixtures.
const jdlFiles = globSync(['lib/jdl/**/*.jdl', '.blueprint/generate-sample/templates/**/*.jdl'], {
  cwd: rootDir,
  exclude: ['lib/jdl/core/__test-support__/files/json_to_jdl_converter/**'],
}).sort();

const runtime = getDefaultRuntime();

describe('jdl - golden', () => {
  it('should find the jdl files', () => {
    expect(jdlFiles.length).toBeGreaterThan(50);
  });

  for (const jdlFile of jdlFiles) {
    describe(jdlFile, () => {
      let importState: ImportState | undefined;
      let importError: string | undefined;

      before(async () => {
        // The importer reads the .yo-rc.json and the entities of the current directory.
        await helpers.prepareTemporaryDir();
        try {
          importState = createImporterFromFiles([join(rootDir, jdlFile)], {
            applicationName: 'jhipster',
            applicationType: 'monolith',
            skipDeploymentFileGeneration: true,
          }).import();
        } catch (error) {
          importError = (error as Error).message.replaceAll(rootDir, '<root>');
        }
      });

      it('should match the imported state', () => {
        expect(importError ?? importState).toMatchSnapshot();
      });

      it('should match the jdl exported from each application', () => {
        let applications = importState?.exportedApplicationsWithEntities ?? {};
        if (importState && Object.keys(applications).length === 0 && importState.exportedEntities.length > 0) {
          // A jdl without application is exported with the application it was imported into.
          applications = {
            jhipster: { config: { baseName: 'jhipster', applicationType: 'monolith' }, entities: importState.exportedEntities },
          };
        }
        const exported = Object.fromEntries(
          Object.entries(applications).map(([name, { config, namespaceConfigs, entities }]) => [
            name,
            convertSingleContentToJDL(
              { ...namespaceConfigs, 'generator-jhipster': config },
              runtime,
              new Map(entities.map(entity => [entity.name, entity])),
            ),
          ]),
        );
        expect(exported).toMatchSnapshot();
      });
    });
  }
});
