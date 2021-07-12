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
const {
  BUILD_TOOL,
  BUILD_TOOL_OPTION_NAME,
  BUILD_TOOL_DESCRIPTION,
  PACKAGE_NAME,
  PACKAGE_NAME_OPTION_NAME,
  PACKAGE_NAME_DESCRIPTION,
} = require('./constants');
const { MAVEN, MAVEN_DESCRIPTION } = require('../maven/constants');

const DEFAULT_BUILD_TOOL = MAVEN;

const BUILD_TOOL_PROMPT_CHOICES = [{ value: MAVEN, name: MAVEN_DESCRIPTION }];

module.exports.loadOptionsConstants = function (into) {
  into.DEFAULT_BUILD_TOOL = DEFAULT_BUILD_TOOL;
  into.BUILD_TOOL_PROMPT_CHOICES = BUILD_TOOL_PROMPT_CHOICES;
};

module.exports.DEFAULT_BUILD_TOOL = DEFAULT_BUILD_TOOL;

module.exports.BUILD_TOOL_PROMPT_CHOICES = BUILD_TOOL_PROMPT_CHOICES;

module.exports.applicationOptions = {
  BUILD_TOOL,
  PACKAGE_NAME,
};

module.exports.applicationOptionValues = {
  BUILD_TOOL_MAVEN: MAVEN,
};

module.exports.options = {
  [PACKAGE_NAME_OPTION_NAME]: {
    desc: PACKAGE_NAME_DESCRIPTION,
    type: String,
    scope: 'storage',
  },
  [BUILD_TOOL_OPTION_NAME]: {
    desc: BUILD_TOOL_DESCRIPTION,
    type: String,
    scope: 'storage',
  },
};
