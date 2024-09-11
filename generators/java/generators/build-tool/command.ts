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
import type { JHipsterCommandDefinition } from '../../../../lib/command/types.js';
import { buildToolTypes } from '../../../../lib/jhipster/index.js';
import { GENERATOR_GRADLE, GENERATOR_MAVEN } from '../../../generator-list.js';

const { GRADLE, MAVEN } = buildToolTypes;

const command = {
  options: {},
  configs: {
    buildTool: {
      cli: {
        name: 'build',
        type: String,
      },
      prompt: {
        type: 'list',
        message: 'Would you like to use Maven or Gradle for building the backend?',
      },
      choices: [
        { name: 'Maven', value: MAVEN },
        { name: 'Gradle', value: GRADLE },
      ],
      default: MAVEN,
      description: 'Provide build tool for the application when skipping server side generation',
      scope: 'storage',
    },
  },
  import: [GENERATOR_GRADLE, GENERATOR_MAVEN],
} as const satisfies JHipsterCommandDefinition;

export default command;
