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
import chalk from 'chalk';
import { isMatch } from 'lodash-es';

import { buildServerMatrix } from '../../lib/testing/index.js';
import { applyChanges } from './support/apply-changes.js';
import BaseGenerator from 'generator-jhipster/generators/base';

export default class ApplyGenerator extends BaseGenerator {
  constructor(args, options, features) {
    super(args, options, { queueCommandTasks: true, ...features });
  }

  get [BaseGenerator.WRITING]() {
    return this.asWritingTaskGroup({
      async writing() {
        const { contextSize, fuzzFactor } = this;
        let { maxSamples } = this;
        const options = { contextSize, fuzzFactor };
        let commonConfig;
        if (['angular', 'vue', 'react'].includes(this.preset)) {
          commonConfig = { clientFramework: this.preset, skipServer: true };
        } else if (this.preset === 'java') {
          commonConfig = { skipClient: true };
        }

        for (const [sampleName, config] of Object.entries(buildServerMatrix())) {
          if (
            isMatch(config, { websocket: true, applicationType: 'gateway' }) ||
            isMatch(config, { websocket: true, applicationType: 'microservice' })
          ) {
            config.websocket = false;
          }
          if (maxSamples !== undefined && maxSamples-- <= 0) {
            break;
          }

          const { missingTemplates, colored } = await applyChanges({ ...config, ...commonConfig }, options);
          this.log.verboseInfo(`Sample result ${sampleName}`);
          for (const missingTemplate of missingTemplates) {
            this.log.debug(chalk.yellow('missing template file'), missingTemplate);
          }
          for (const coloredLog of colored) {
            this.log.colored(coloredLog);
          }
        }
      },
    });
  }
}
