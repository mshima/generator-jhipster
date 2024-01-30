/**
 * Copyright 2013-2024 the original author or authors from the JHipster project.
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
import type { GeneratorDefinition } from '../base-application/generator.js';
import { clientApplicationTemplatesBlock } from '../client/support/files.js';
import CoreGenerator from '../base-core/index.js';
import { WriteFileSection } from '../base/api.js';
import { asWritingEntitiesTask } from '../base-application/support/task-type-inference.js';

const entityModelFiles = clientApplicationTemplatesBlock({
  templates: ['_entities_/_entityFolder_/_entityFile_.model.ts', '_entities_/_entityFolder_/_entityFile_.test-samples.ts'],
});

const entityServiceFiles = clientApplicationTemplatesBlock({
  condition: generator => !generator.embedded,
  templates: ['_entities_/_entityFolder_/service/_entityFile_.service.ts', '_entities_/_entityFolder_/service/_entityFile_.service.spec.ts'],
});

export const builtInFiles: WriteFileSection = {
  model: [entityModelFiles],
  service: [entityServiceFiles],
};

export const angularFiles = {
  model: [entityModelFiles],
  service: [entityServiceFiles],
  client: [
    clientApplicationTemplatesBlock({
      condition: generator => !generator.embedded,
      templates: [
        '_entities_/_entityFolder_/_entityFile_.routes.ts',
        '_entities_/_entityFolder_/detail/_entityFile_-detail.component.html',
        '_entities_/_entityFolder_/detail/_entityFile_-detail.component.ts',
        '_entities_/_entityFolder_/detail/_entityFile_-detail.component.spec.ts',
        '_entities_/_entityFolder_/list/_entityFile_.component.html',
        '_entities_/_entityFolder_/list/_entityFile_.component.ts',
        '_entities_/_entityFolder_/list/_entityFile_.component.spec.ts',
        '_entities_/_entityFolder_/route/_entityFile_-routing-resolve.service.ts',
        '_entities_/_entityFolder_/route/_entityFile_-routing-resolve.service.spec.ts',
      ],
    }),
    clientApplicationTemplatesBlock({
      condition: generator => !generator.readOnly && !generator.embedded,
      templates: [
        '_entities_/_entityFolder_/update/_entityFile_-form.service.ts',
        '_entities_/_entityFolder_/update/_entityFile_-form.service.spec.ts',
        '_entities_/_entityFolder_/update/_entityFile_-update.component.html',
        '_entities_/_entityFolder_/update/_entityFile_-update.component.spec.ts',
        '_entities_/_entityFolder_/delete/_entityFile_-delete-dialog.component.html',
        '_entities_/_entityFolder_/update/_entityFile_-update.component.ts',
        '_entities_/_entityFolder_/delete/_entityFile_-delete-dialog.component.ts',
        '_entities_/_entityFolder_/delete/_entityFile_-delete-dialog.component.spec.ts',
      ],
    }),
  ],
};

export const userManagementFiles: WriteFileSection = {
  userManagement: [
    clientApplicationTemplatesBlock({
      condition: generator => generator.generateUserManagement,
      templates: [
        'admin/user-management/user-management.route.ts',
        'admin/user-management/user-management.model.ts',
        'admin/user-management/list/user-management.component.html',
        'admin/user-management/list/user-management.component.spec.ts',
        'admin/user-management/list/user-management.component.ts',
        {
          sourceFile: '_entities_/_entityFolder_/detail/_entityFile_-detail.component.html',
          renameTo: 'admin/user-management/detail/user-management-detail.component.html',
        },
        'admin/user-management/detail/user-management-detail.component.spec.ts',
        {
          sourceFile: '_entities_/_entityFolder_/detail/_entityFile_-detail.component.ts',
          renameTo: 'admin/user-management/detail/user-management-detail.component.ts',
        },
        'admin/user-management/update/user-management-update.component.html',
        'admin/user-management/update/user-management-update.component.spec.ts',
        'admin/user-management/update/user-management-update.component.ts',
        'admin/user-management/delete/user-management-delete-dialog.component.html',
        'admin/user-management/delete/user-management-delete-dialog.component.spec.ts',
        'admin/user-management/delete/user-management-delete-dialog.component.ts',
        'admin/user-management/service/user-management.service.spec.ts',
        'admin/user-management/service/user-management.service.ts',
      ],
    }),
  ],
};

export const writeEntitiesFiles = asWritingEntitiesTask(async function (this: CoreGenerator, { application, entities }: GeneratorDefinition['writingEntitiesTaskParam']) {
  for (const entity of entities.filter(entity => !entity.skipClient)) {
    if (entity.builtInUser) {
      await this.writeFiles({
        sections: builtInFiles,
        context: {
          ...application,
          ...entity,
          fields: entity.fields.filter(field => ['id', 'login'].includes(field.fieldName)),
          readOnly: true,
        },
      });

      if (application.generateUserManagement) {
        await this.writeFiles({
          sections: angularFiles,
          context: {
            ...application,
            ...entity,
            i18nKeyPrefix: 'userManagement',
            entityFolderName: 'user-management',
            entityFileName: 'user-management',
            entityRootFolder: 'admin/',
          },
        });
      }
    } else {
      await this.writeFiles({
        sections: angularFiles,
        context: { ...application, ...entity },
      });
    }
  }
});

export async function postWriteEntitiesFiles(this: CoreGenerator, taskParam: GeneratorDefinition['postWritingEntitiesTaskParam']) {
  const { source, application } = taskParam;
  const entities = taskParam.entities.filter(entity => !entity.skipClient && !entity.builtInUser && !entity.embedded);
  source.addEntitiesToClient({ application, entities });
}

export function cleanupEntitiesFiles(this: CoreGenerator, { application, entities }: GeneratorDefinition['writingEntitiesTaskParam']) {
  for (const entity of entities.filter(entity => !entity.skipClient && !entity.builtIn)) {
    const { entityFolderName, entityFileName, name: entityName } = entity;
    if (this.isJhipsterVersionLessThan('5.0.0')) {
      this.removeFile(`${application.clientSrcDir}app/_entities_/${entityName}/${entityName}.model.ts`);
    }

    if (this.isJhipsterVersionLessThan('6.3.0')) {
      this.removeFile(`${application.clientSrcDir}app/_entities_/${entityFolderName}/index.ts`);
    }

    if (this.isJhipsterVersionLessThan('7.0.0-beta.0')) {
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}.route.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}.component.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}.component.html`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-detail.component.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-detail.component.html`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-delete-dialog.component.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-delete-dialog.component.html`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-update.component.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-update.component.html`);
      this.removeFile(`${application.clientSrcDir}/app/shared/model/${entity.entityModelFileName}.model.ts`);
      entity.fields.forEach(field => {
        if (field.fieldIsEnum === true) {
          const { enumFileName } = field;
          this.removeFile(`${application.clientSrcDir}/app/shared/model/enumerations/${enumFileName}.model.ts`);
        }
      });
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-routing-resolve.service.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}-routing.module.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}.service.ts`);
      this.removeFile(`${application.clientSrcDir}/app/_entities_/${entityFolderName}/${entityFileName}.service.spec.ts`);
      this.removeFile(`${application.clientTestDir}/spec/app/_entities_/${entityFolderName}/${entityFileName}.component.spec.ts`);
      this.removeFile(`${application.clientTestDir}/spec/app/_entities_/${entityFolderName}/${entityFileName}-detail.component.spec.ts`);
      this.removeFile(
        `${application.clientTestDir}/spec/app/_entities_/${entityFolderName}/${entityFileName}-delete-dialog.component.spec.ts`,
      );
      this.removeFile(`${application.clientTestDir}/spec/app/_entities_/${entityFolderName}/${entityFileName}-update.component.spec.ts`);
      this.removeFile(`${application.clientTestDir}/spec/app/_entities_/${entityFolderName}/${entityFileName}.service.spec.ts`);
    }

    if (this.isJhipsterVersionLessThan('7.10.0')) {
      this.removeFile(`${application.clientSrcDir}app/_entities_/${entityFolderName}/${entityFileName}.module.ts`);
      this.removeFile(`${application.clientSrcDir}app/_entities_/${entityFolderName}/route/${entityFileName}-routing.module.ts`);
    }
  }
}
