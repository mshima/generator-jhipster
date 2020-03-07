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
const assert = require('assert');
const constants = require('../generator-constants');
const writeFiles = require('./files').writeFiles;
const BaseBlueprintGenerator = require('../generator-base-blueprint');

const INTERPOLATE_REGEX = constants.INTERPOLATE_REGEX;
const SERVER_MAIN_RES_DIR = constants.SERVER_MAIN_RES_DIR;

/* constants used throughout */
let useBlueprints;

module.exports = class extends BaseBlueprintGenerator {
    constructor(args, opts) {
        super(args, opts);
        this.jhipsterContext = opts.jhipsterContext || opts.context;
        this.configOptions = opts.configOptions || {};

        useBlueprints = !this.fromBlueprint && this.instantiateBlueprints('versioned-database-liquibase');

        assert(this.options.databaseChangelog, 'Changelog is required');
    }

    // Public API method used by the getter and also by Blueprints
    _configuring() {
        return {
            setupConstants() {
                // Make constants available in templates
                this.LIQUIBASE_DTD_VERSION = constants.LIQUIBASE_DTD_VERSION;
            }
        };
    }

    get configuring() {
        if (useBlueprints) return;
        return this._configuring();
    }

    // Public API method used by the getter and also by Blueprints
    _writing() {
        return writeFiles();
    }

    get writing() {
        if (useBlueprints) return;
        return this._writing();
    }

    /**
     * Write a changelog entry to master.xml and creates a changelog file.
     * @param {Object} changelog - The changelog difinition
     * @param {String} [changelogType] - Custom changelog variation
     */
    _writeCustomChangelog(changelog, changelogType = 'custom') {
        this._writeChangelog(changelogType, `${changelog.changelogDate}_${changelogType}_${changelog.name || changelog.entityName}`, {
            ...changelog,
            changelogType
        });
    }

    /**
     * Write a changelog entry to master.xml and creates a changelog file.
     * @param {String} source - Source file
     * @param {String} destFile - The destination file
     * @param {Object} changelog = the changelog definition
     */
    _writeChangelog(source, destFile, changelog) {
        this.template(
            `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/${source}.xml.ejs`,
            `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/${destFile}.xml`,
            this,
            { interpolate: INTERPOLATE_REGEX },
            { changelog, LIQUIBASE_DTD_VERSION: constants.LIQUIBASE_DTD_VERSION }
        );
        this.addNewChangelogToLiquibase(destFile);
    }
};
