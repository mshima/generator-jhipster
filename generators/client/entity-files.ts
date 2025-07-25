/**
 * Copyright 2013-2025 the original author or authors from the JHipster project.
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
import { CLIENT_MAIN_SRC_DIR } from '../generator-constants.js';
import { getEnumInfo } from '../base-application/support/index.js';
import type CoreGenerator from '../base-core/generator.js';
import type { Application as ClientApplication, Entity as ClientEntity } from './types.d.ts';

export async function addEnumerationFiles(
  this: CoreGenerator,
  { application, entity }: { application: ClientApplication; entity: ClientEntity },
) {
  for (const field of entity.fields) {
    if (field.fieldIsEnum === true) {
      const { enumFileName } = field;
      const enumInfo = {
        ...getEnumInfo(field, entity.clientRootFolder),
        frontendAppName: application.frontendAppName,
        packageName: application.packageName,
        webappEnumerationsDir: application.webappEnumerationsDir,
      };
      await this.writeFiles({
        templates: [
          {
            sourceFile: `${CLIENT_MAIN_SRC_DIR}app/entities/enumerations/enum.model.ts`,
            destinationFile: `${application.webappEnumerationsDir}${enumFileName}.model.ts`,
          },
        ],
        context: enumInfo,
      });
    }
  }
}
