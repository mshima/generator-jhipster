/**
 * Copyright 2013-2020 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const chalk = require('chalk');
const utils = require('../utils');
const constants = require('../generator-constants');

/* Constants use throughout */
const INTERPOLATE_REGEX = constants.INTERPOLATE_REGEX;
const SERVER_MAIN_SRC_DIR = constants.SERVER_MAIN_SRC_DIR;
const SERVER_MAIN_RES_DIR = constants.SERVER_MAIN_RES_DIR;
const TEST_DIR = constants.TEST_DIR;
const SERVER_TEST_SRC_DIR = constants.SERVER_TEST_SRC_DIR;

/**
 * The default is to use a file path string. It implies use of the template method.
 * For any other config an object { file:.., method:.., template:.. } can be used
 */
const serverFiles = {
    dbChangelog: [
        {
            condition: generator => generator.databaseType === 'cassandra' && !generator.skipDbChangelog,
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/cql/changelog/added_entity.cql',
                    renameTo: generator => `config/cql/changelog/${generator.changelogDate}_added_entity_${generator.entityClass}.cql`,
                },
            ],
        },
        {
            condition: generator => generator.searchEngine === 'couchbase' && !generator.skipDbChangelog,
            path: SERVER_MAIN_RES_DIR,
            templates: [
                {
                    file: 'config/couchmove/changelog/entity.fts',
                    renameTo: generator =>
                        `config/couchmove/changelog/V${generator.changelogDate}__${generator.entityInstance.toLowerCase()}.fts`,
                },
            ],
        },
    ],
    server: [
        {
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/domain/Entity.java',
                    relativeClassPath: generator => `${generator.packageName}.domain.${generator.entityPO}`,
                },
            ],
        },
        {
            condition: generator => !generator.embedded,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/web/rest/EntityResource.java',
                    relativeClassPath: generator => `${generator.packageName}.web.rest.${generator.entityClass}Resource`,
                },
            ],
        },
        {
            condition: generator => generator.jpaMetamodelFiltering,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/service/dto/EntityCriteria.java',
                    relativeClassPath: generator => `${generator.packageName}.service.dto.${generator.entityClass}Criteria`,
                },
                {
                    file: 'package/service/EntityQueryService.java',
                    relativeClassPath: generator => `${generator.packageName}.service.${generator.entityClass}QueryService`,
                },
            ],
        },
        {
            condition: generator => generator.searchEngine === 'elasticsearch',
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/repository/search/EntitySearchRepository.java',
                    relativeClassPath: generator => `${generator.packageName}.repository.search.${generator.entityClass}SearchRepository`,
                },
            ],
        },
        {
            condition: generator => !generator.reactive && !generator.embedded,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/repository/EntityRepository.java',
                    relativeClassPath: generator => `${generator.packageName}.repository.${generator.entityClass}Repository`,
                },
            ],
        },
        {
            condition: generator => generator.reactive && !generator.embedded,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/repository/EntityReactiveRepository.java',
                    relativeClassPath: generator => `${generator.packageName}.repository.${generator.entityClass}ReactiveRepository`,
                },
            ],
        },
        {
            condition: generator => generator.reactive && generator.databaseType === 'sql' && !generator.embedded,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/repository/EntityReactiveRepositoryInternalImpl.java',
                    relativeClassPath: generator => `${generator.packageName}.repository.${generator.entityClass}InternalImpl`,
                },
                {
                    file: 'package/repository/rowmapper/EntityRowMapper.java',
                    relativeClassPath: generator => `${generator.packageName}.repository.rowmapper.${generator.entityClass}RowMapper`,
                },
            ],
        },
        {
            condition: generator => generator.service === 'serviceImpl' && !generator.embedded,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/service/EntityService.java',
                    relativeClassPath: generator => `${generator.packageName}.service.${generator.entityClass}Service`,
                },
                {
                    file: 'package/service/impl/EntityServiceImpl.java',
                    relativeClassPath: generator => `${generator.packageName}.service.impl.${generator.entityClass}ServiceImpl`,
                },
            ],
        },
        {
            condition: generator => generator.service === 'serviceClass' && !generator.embedded,
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/service/impl/EntityServiceImpl.java',
                    relativeClassPath: generator => `${generator.packageName}.service.impl.${generator.entityClass}Service`,
                },
            ],
        },
    ],
    test: [
        {
            condition: generator => !generator.embedded,
            path: SERVER_TEST_SRC_DIR,
            templates: [
                {
                    file: 'package/web/rest/EntityResourceIT.java',
                    relativeClassPath: generator => `${generator.packageName}.web.rest.${generator.entityClass}ResourceIT`,
                },
            ],
        },
        {
            condition: generator => generator.searchEngine === 'elasticsearch',
            path: SERVER_TEST_SRC_DIR,
            templates: [
                {
                    file: 'package/repository/search/EntitySearchRepositoryMockConfiguration.java',
                    relativeClassPath: generator =>
                        `${generator.packageName}.repository.search.${generator.entityClass}SearchRepositoryMockConfiguration`,
                },
            ],
        },
        {
            condition: generator => generator.gatlingTests,
            path: TEST_DIR,
            templates: [
                {
                    file: 'gatling/user-files/simulations/EntityGatlingTest.scala',
                    options: { interpolate: INTERPOLATE_REGEX },
                    renameTo: generator => `gatling/user-files/simulations/${generator.entityClass}GatlingTest.scala`,
                },
            ],
        },
        {
            path: SERVER_TEST_SRC_DIR,
            templates: [
                {
                    file: 'package/domain/EntityTest.java',
                    relativeClassPath: generator => `${generator.packageName}.domain.${generator.entityClass}Test`,
                },
            ],
        },
    ],
};

const dtoFiles = {
    dto: [
        {
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/service/dto/EntityDTO.java',
                    relativeClassPath: generator => `${generator.packageName}.service.dto.${generator.entityClass}DTO`,
                },
                {
                    file: 'package/service/mapper/BaseEntityMapper.java',
                    relativeClassPath: generator => `${generator.packageName}.service.mapper.BaseEntityMapper`,
                },
                {
                    file: 'package/service/mapper/EntityMapper.java',
                    relativeClassPath: generator => `${generator.packageName}.service.mapper.${generator.entityClass}EntityMapper`,
                },
            ],
        },
        {
            path: SERVER_TEST_SRC_DIR,
            templates: [
                {
                    file: 'package/service/dto/EntityDTOTest.java',
                    relativeClassPath: generator => `${generator.packageName}.service.dto.${generator.entityClass}DTOTest`,
                },
            ],
        },
        {
            condition: (_generator, data) => ['sql', 'mongodb', 'couchbase', 'neo4j'].includes(data.databaseType),
            path: SERVER_TEST_SRC_DIR,
            templates: [
                {
                    file: 'package/service/mapper/EntityMapperTest.java',
                    relativeClassPath: generator => `${generator.packageName}.service.mapper.${generator.entityClass}MapperTest`,
                },
            ],
        },
    ],
};

const newDtoFiles = {
    dto: [
        {
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/service/dto/BeanDTO.java',
                    renameTo: (_generator, data) => `${data.dtoBaseName}.java`,
                },
                {
                    file: 'package/service/dto/BeanDTOMapper.java',
                    renameTo: (_generator, data) => `${data.dtoMapperFolder}/${data.entityClass}${data.dtoSuffix}Mapper.java`,
                },
            ],
        },
    ],
};

const domainFiles = {
    domainConfig: [
        {
            path: SERVER_MAIN_SRC_DIR,
            templates: [
                {
                    file: 'package/config/DomainConfiguration.java',
                    renameTo: generator => `${generator.filePathFromClassPath(generator.entityRepositoryConfigurationClassPath)}.java`,
                },
            ],
        },
    ],
};

module.exports = {
    writeFiles,
    serverFiles,
    dtoFiles,
    domainFiles,
};

function writeFiles() {
    return {
        setupReproducibility() {
            if (this.skipServer) return;

            // In order to have consistent results with Faker, restart seed with current entity name hash.
            this.resetFakerSeed();
        },

        writeServerFiles() {
            if (this.skipServer) return;

            this.chalkRed = chalk.red;

            // write server side files
            this.writeFilesToDisk(serverFiles);

            // write dto files for the domain service
            if (this.dto === 'mapstruct') {
                this.writeFilesToDisk(dtoFiles, this, false, this.fetchFromInstalledJHipster('entity-server/templates'), {
                    ...this.entity,
                    dtoType: 'relationshipKeyValue',
                    dtoSuffix: this.dtoSuffix,
                    domainDomainPackage: this.domainDomainPackage,
                    importApiModelProperty: this.importApiModelProperty,
                    uniqueEnums: this.uniqueEnums,
                    dtoPackage: this.domainControllerDtoPackageName,
                    dtoClassPath: this.entityControllerDtoClassPath,
                    dtoFolder: this.packageAsFolder(this.domainControllerDtoPackageName),
                    dtoBaseName: this.packageAsFolder(this.entityControllerDtoClassPath),
                    dtoMapperPackage: this.domainControllerMapperPackage,
                    dtoMapperFolder: this.packageAsFolder(this.domainControllerMapperPackage),
                    entityPOClassPath: this.entityPOClassPath,
                });
            }

            const addDtoForPort = port => {
                const domainNamePackageName = this._.lowerFirst(this.entity.domainName);
                const portPackage = `${this.packageName}.${domainNamePackageName}.${this.portsPackage}.${port}`;
                const dtoSuffix = this._.upperFirst(port);
                const dtoPackage = `${portPackage}.dto`;
                const dtoClassPath = `${dtoPackage}.${this.entityClass}${dtoSuffix}`;
                this.writeFilesToDisk(newDtoFiles, this, false, this.fetchFromInstalledJHipster('entity-server/templates'), {
                    ...this.entity,
                    dtoType: 'relationshipKeyValue',
                    entityPOClassPath: this.entityPOClassPath,
                    dtoSuffix,
                    importApiModelProperty: this.importApiModelProperty,
                    domainDomainPackage: this.domainDomainPackage,
                    uniqueEnums: [],
                    dtoPackage,
                    dtoClassPath,
                    dtoFolder: this.packageAsFolder(dtoPackage),
                    dtoBaseName: this.packageAsFolder(`${dtoClassPath}`),
                    dtoMapperPackage: `${dtoPackage}.mapper`,
                    dtoMapperFolder: this.packageAsFolder(`${dtoPackage}.mapper`),
                });
            };

            if (this.entity.domainName) {
                // addDtoForPort(this.entity.domainData.repositoryPort);
                // addDtoForPort(this.entity.domainData.webPort);
                if (this.entity.additionalPorts) {
                    this.entity.additionalPorts.forEach(port => addDtoForPort(port));
                }
            }

            // write domain files.
            if (this.domainName) {
                this.writeFilesToDisk(domainFiles, this, false, this.fetchFromInstalledJHipster('entity-server/templates'));
            }

            if (this.databaseType === 'sql') {
                if (['ehcache', 'caffeine', 'infinispan', 'redis'].includes(this.cacheProvider) && this.enableHibernateCache) {
                    const entityClassNameGetter = `${this.resolveClassPath(this.entityPOClassPath)}.class.getName()`;
                    this.addEntryToCache(entityClassNameGetter, this.packageFolder, this.cacheProvider);
                    this.relationships.forEach(relationship => {
                        if (relationship.relationshipType === 'one-to-many' || relationship.relationshipType === 'many-to-many') {
                            this.addEntryToCache(
                                `${entityClassNameGetter} + ".${relationship.relationshipFieldNamePlural}"`,
                                this.packageFolder,
                                this.cacheProvider
                            );
                        }
                    });
                }
            }
        },

        writeEnumFiles() {
            this.fields.forEach(field => {
                if (!field.fieldIsEnum) {
                    return;
                }
                const fieldType = field.fieldType;
                const enumInfo = {
                    ...utils.getEnumInfo(field, this.clientRootFolder),
                    frontendAppName: this.frontendAppName,
                    packageName: this.packageName,
                    classPackage: `${this.packageName}.domain.enumeration`,
                };
                // eslint-disable-next-line no-console
                if (!this.skipServer) {
                    const pathToTemplateFile = `${this.fetchFromInstalledJHipster(
                        'entity-server/templates'
                    )}/${SERVER_MAIN_SRC_DIR}package/domain/enumeration/Enum.java.ejs`;
                    this.template(
                        pathToTemplateFile,
                        `${SERVER_MAIN_SRC_DIR}${this.filePathFromClassPath(`domain.enumeration.${fieldType}`)}`,
                        this,
                        {},
                        {
                            ...enumInfo,
                            domainDomainPackage: this.domainDomainPackage,
                        }
                    );
                }
            });
        },
    };
}
