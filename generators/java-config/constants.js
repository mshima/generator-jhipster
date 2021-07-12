/**
 * Copyright 2013-2021 the original author or authors from the JHipster project.
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
const { kebabCase } = require('lodash');

const BUILD_TOOL = 'buildTool';
const PACKAGE_NAME = 'packageName';

const JAVA_VERSION = '11';
const JAVA_COMPATIBLE_VERSIONS = ['1.8', '1.9', '10', '11', '12', '13', '14', '15', '16'];
const JHIPSTER_BOM_VERSION = '7.1.1-SNAPSHOT';

function loadConstants(into) {
  into.JAVA_VERSION = JAVA_VERSION;
  into.JAVA_COMPATIBLE_VERSIONS = JAVA_COMPATIBLE_VERSIONS;
  into.JHIPSTER_BOM_VERSION = JHIPSTER_BOM_VERSION;
}

module.exports = {
  BUILD_TOOL,
  BUILD_TOOL_OPTION_NAME: kebabCase(BUILD_TOOL),
  BUILD_TOOL_DESCRIPTION: 'Build tool',
  PACKAGE_NAME,
  PACKAGE_NAME_OPTION_NAME: kebabCase(PACKAGE_NAME),
  PACKAGE_NAME_DESCRIPTION: 'Application package name',
  JAVA_VERSION,
  JAVA_COMPATIBLE_VERSIONS,
  loadConstants,
};
