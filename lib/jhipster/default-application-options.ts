/**
 * Copyright 2013-2026 the original author or authors from the JHipster project.
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

import { getApplicationConfigWithDefaults } from '../command/config-defaults.ts';
import type { ConfigAll } from '../types/command-all.ts';

type ApplicationDefaults = Partial<ConfigAll>;

/**
 * The configuration with the defaults the commands declare for the options that are not set.
 */
export function getConfigWithDefaults(customOptions: ApplicationDefaults = {}): ApplicationDefaults {
  const options: ApplicationDefaults = { ...customOptions };
  // Forced by another option rather than defaulted: applied before the defaults, which read them.
  // TODO move to the configuring tasks of the owning generators.
  if (options.graalvmSupport) {
    options.cacheProvider = 'no';
  }
  if (options.skipClient) {
    options.clientFramework = 'no';
  }
  if (options.applicationType === 'gateway') {
    options.enableHibernateCache = false;
  }
  if (options.applicationType === 'microservice') {
    options.withAdminUi = false;
  }
  if (options.databaseType === 'no') {
    options.skipUserManagement = true;
  }
  return getApplicationConfigWithDefaults(options);
}
