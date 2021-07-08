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

const {
  constants: { MAVEN, MAVEN_DESCRIPTION },
} = require('../maven/options');

const BUILD_TOOL = 'buildTool';
const BUILD_TOOL_OPTION_NAME = kebabCase(BUILD_TOOL);
const BUILD_TOOL_DESCRIPTION = 'Build tool';
const GRADLE = 'gradle';
const DEFAULT_BUILD_TOOL = MAVEN;
const BUILD_TOOL_CHOICES = [
  { value: MAVEN, name: MAVEN_DESCRIPTION },
  { value: GRADLE, name: 'Gradle' },
];

module.exports.constants = {
  BUILD_TOOL,
  BUILD_TOOL_OPTION_NAME,
  DEFAULT_BUILD_TOOL,
  MAVEN,
  GRADLE,
};

module.exports.applicationOptions = {
  BUILD_TOOL,
};

module.exports.applicationOptionValues = {
  BUILD_TOOL_MAVEN: MAVEN,
  BUILD_TOOL_GRADLE: GRADLE,
};

module.exports.options = {
  [BUILD_TOOL_OPTION_NAME]: {
    desc: BUILD_TOOL_DESCRIPTION,
    type: String,
    scope: 'storage',
  },
};

module.exports.prompts = [
  {
    name: BUILD_TOOL,
    type: 'list',
    choices: BUILD_TOOL_CHOICES,
    message: 'What tool do you want to use to build backend?',
    default: DEFAULT_BUILD_TOOL,
  },
];
