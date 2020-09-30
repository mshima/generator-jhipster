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
/* eslint-disable consistent-return */
const constants = require('../generator-constants');
const writeFiles = require('./files').writeFiles;
const utils = require('../utils');
const BaseBlueprintGenerator = require('../generator-base-blueprint');
const { isReservedTableName } = require('../../jdl/jhipster/reserved-keywords');

/* constants used throughout */
let useBlueprints;

module.exports = class extends BaseBlueprintGenerator {
    constructor(args, opts) {
        super(args, opts);

        // Context is the entity for entity-* generators
        this.entity = opts.context;
        utils.copyObjectProps(this, this.entity);
        this.jhipsterContext = opts.jhipsterContext || opts.context;

        this.testsNeedCsrf = ['uaa', 'oauth2', 'session'].includes(this.jhipsterContext.authenticationType);
        this.officialDatabaseType = constants.OFFICIAL_DATABASE_TYPE_NAMES[this.jhipsterContext.databaseType];

        useBlueprints = !this.fromBlueprint && this.instantiateBlueprints('entity-server', { context: opts.context });
    }

    // Public API method used by the getter and also by Blueprints
    _initializing() {
        return {
            setupConstants() {
                // Make constants available in templates
                this.LIQUIBASE_DTD_VERSION = constants.LIQUIBASE_DTD_VERSION;
            },
        };
    }

    get initializing() {
        if (useBlueprints) return;
        return this._initializing();
    }

    _preparing() {
        return {
            /**
             * Generate paths to files and resources.
             */
            generatePaths() {
                let repositoryPort;
                let webPort;
                let webAdapter;
                const enableDomain = !!this.domainName;
                this.portsPackage = this.portsPackage || 'ports';
                this.adaptersPackage = this.adaptersPackage || 'adapters';
                if (enableDomain) {
                    this.warning('Domain support is experimental and subject to change, use at your own risk');
                    this.domainName = this._.upperFirst(this.domainName);
                    const domain = this.configOptions.domains[this.domainName] || {};
                    this.entity.domainData = domain;
                    repositoryPort = domain.repositoryPort;
                    webPort = domain.webPort;
                    webAdapter = domain.webAdapter;
                } else {
                    // set as undefined for templates.
                    this.domainName = undefined;
                }
                const domainNamePackage = this._.lowerFirst(this.domainName);

                const domainPackage = enableDomain ? `${this.packageName}.${domainNamePackage}` : this.packageName;
                const domainRelativeModelPackage = enableDomain ? 'domain' : 'domain';
                const domainRelativeRepositoryPackage = enableDomain ? `${this.portsPackage}.${repositoryPort}` : 'repository';
                const domainRelativeWebPackage = enableDomain ? `${this.adaptersPackage}.${webAdapter}` : 'web.rest';
                const domainRelativeServicePackage = enableDomain ? `${this.portsPackage}.${webPort}` : 'service';

                const domainDomainPackage = `${domainPackage}.${domainRelativeModelPackage}`;
                const domainRepositoryPackageName = `${domainPackage}.${domainRelativeRepositoryPackage}`;
                const domainWebPackageName = `${domainPackage}.${domainRelativeWebPackage}`;
                const domainServicePackageName = `${domainPackage}.${domainRelativeServicePackage}`;

                const domainFilteringPackageName = enableDomain
                    ? `${domainPackage}.${domainRelativeServicePackage}.filtering`
                    : `${domainPackage}.${domainRelativeServicePackage}.dto`;

                const domainRelativeControllerDtoPackage =
                    this.configOptions.domainRelativeControllerPackage || enableDomain
                        ? domainRelativeWebPackage
                        : domainRelativeServicePackage;

                const domainControllerDtoPackageName = `${domainPackage}.${domainRelativeControllerDtoPackage}.dto`;
                const domainControllerMapperPackage = enableDomain
                    ? `${domainControllerDtoPackageName}.mapper`
                    : `${domainPackage}.service.mapper`;

                const domainSearchImplPackage = enableDomain ? domainRepositoryPackageName : domainServicePackageName;

                const entityPackage = domainDomainPackage;
                const entityRepositoryDtoPackage = domainControllerDtoPackageName;
                const entityRepositoryPackage = domainRepositoryPackageName;
                // const entityServicePackage = enableDomain ? domainDomainPackage : domainServicePackageName;

                const entityBOClassPath = `${entityPackage}.${this.asEntity(this.entityClass)}`;
                const entityRepositoryClassPath = enableDomain
                    ? `${entityRepositoryPackage}.${this.entityClass}${this._.upperFirst(repositoryPort)}Port`
                    : `${entityRepositoryPackage}.${this.entityClass}Repository`;
                const entityRepositoryConfigurationClassPath = enableDomain
                    ? `${entityRepositoryPackage}.${this.entityClass}${this._.upperFirst(repositoryPort)}PortConfiguration`
                    : undefined;
                const entityControllerClassPath = `${domainWebPackageName}.${this.entityClass}Resource`;
                const entityControllerDtoClassPath = `${entityRepositoryDtoPackage}.${this.asDto(this.entityClass)}`;

                let entityServiceClassPath;
                let entityServiceImplClassPath;
                if (this.service !== 'no') {
                    const entityServiceClassName = enableDomain
                        ? `${this.entityClass}${this._.upperFirst(webPort)}Port`
                        : `${this.entityClass}Service`;
                    entityServiceClassPath = `${domainServicePackageName}.${entityServiceClassName}`;

                    if (this.service === 'serviceImpl') {
                        const entityServiceImplClassName = `${entityServiceClassName}Impl`;
                        entityServiceImplClassPath = enableDomain
                            ? `${domainServicePackageName}.${entityServiceImplClassName}`
                            : `${domainServicePackageName}.impl.${entityServiceImplClassName}`;
                    }
                }

                const java = {
                    domainPackage,
                    entityPackage,

                    domainWebPackageName,
                    domainRepositoryPackageName,
                    domainServicePackageName,

                    domainDomainPackage,
                    domainSearchImplPackage,

                    domainControllerMapperPackage,
                    domainControllerDtoPackageName,
                    domainFilteringPackageName,

                    entityBOClassPath,
                    entityPOClassPath: entityBOClassPath,
                    entityDTOClassPath: entityBOClassPath,

                    entityRepositoryDtoPackage,
                    entityRepositoryPackage,
                    entityRepositoryClassPath,
                    entityRepositoryConfigurationClassPath,

                    entityControllerClassPath,
                    entityControllerDtoClassPath,

                    entityServiceImplClassPath,
                    entityServiceClassPath,
                };
                this.entity.java = java;
                Object.assign(this, java);

                // Export to be used by relationships.
                this.entity.entityBOClassPath = this.entityBOClassPath;
                this.entity.entityRepositoryClassPath = this.entityRepositoryClassPath;
                this.entity.entityControllerClassPath = this.entityControllerClassPath;
                this.entity.entityControllerDtoClassPath = this.entityControllerDtoClassPath;
                this.entity.entityServiceClassPath = this.entityServiceClassPath;
            },

            processUniqueEnums() {
                this.uniqueEnums = {};

                this.fields.forEach(field => {
                    if (
                        field.fieldIsEnum &&
                        (!this.uniqueEnums[field.fieldType] || (this.uniqueEnums[field.fieldType] && field.fieldValues.length !== 0))
                    ) {
                        this.uniqueEnums[field.fieldType] = field.fieldType;
                    }
                });
            },
        };
    }

    get preparing() {
        if (useBlueprints) return;
        return this._preparing();
    }

    // Public API method used by the getter and also by Blueprints
    _default() {
        return {
            ...super._missingPreDefault(),

            /**
             * Process json ignore references to prevent cyclic relationships.
             */
            processJsonIgnoreReferences() {
                this.relationships
                    .filter(relationship => relationship.relationshipOtherSideIgnore === undefined)
                    .forEach(relationship => {
                        relationship.ignoreOtherSideProperty =
                            !relationship.embedded && !!relationship.otherEntity && !!relationship.otherEntity.relationships.length;
                    });
                this.relationshipsContainOtherSideIgnore = this.relationships.some(relationship => relationship.ignoreOtherSideProperty);
            },

            processJavaEntityImports() {
                this.importApiModelProperty =
                    this.relationships.some(relationship => relationship.javadoc) || this.fields.some(field => field.javadoc);
            },

            /**
             * Process relationships that should be imported.
             */
            processRelationshipsFromOtherDomain() {
                this.relatedEntitiesFromAnotherDomain = Array.from(
                    new Set(
                        this.relationships
                            .map(relationship => relationship.otherEntity)
                            .filter(otherEntity => otherEntity && otherEntity.domainName !== this.entity.domainName)
                    )
                );
                this.relatedEntities = Array.from(
                    new Set(this.relationships.map(relationship => relationship.otherEntity).filter(otherEntity => otherEntity))
                );
            },

            useMapsIdRelation() {
                const jpaDerivedRelation = this.relationships.find(rel => rel.useJPADerivedIdentifier === true);
                if (jpaDerivedRelation) {
                    this.isUsingMapsId = true;
                    this.mapsIdAssoc = jpaDerivedRelation;
                    this.hasOauthUser = this.mapsIdAssoc.otherEntityName === 'user' && this.authenticationType === 'oauth2';
                } else {
                    this.isUsingMapsId = false;
                    this.mapsIdAssoc = null;
                    this.hasOauthUser = false;
                }
            },

            processUniqueEntityTypes() {
                this.uniqueEntityTypes = new Set(this.eagerRelations.map(rel => rel.otherEntityNameCapitalized));
                this.uniqueEntityTypes.add(this.entityClass);
            },
        };
    }

    get default() {
        if (useBlueprints) return;
        return this._default();
    }

    // Public API method used by the getter and also by Blueprints
    _writing() {
        return {
            reloadEntityToGenerator() {
                utils.copyObjectProps(this, this.entity);
            },
            ...writeFiles(),
            ...super._missingPostWriting(),
        };
    }

    get writing() {
        if (useBlueprints) return;
        return this._writing();
    }

    /* Private methods used in templates */
    _getJoinColumnName(relationship) {
        if (relationship.useJPADerivedIdentifier === true) {
            return 'id';
        }
        return `${this.getColumnName(relationship.relationshipName)}_id`;
    }

    _generateSqlSafeName(name) {
        if (isReservedTableName(name, 'sql')) {
            return `e_${name}`;
        }
        return name;
    }
};
