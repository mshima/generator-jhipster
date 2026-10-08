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

import type { ApplicationType } from '../core/application-types.ts';

import type { JDLFiles } from './converters/ast-to-files/ast-to-files.ts';
import { errorLocation } from './core/parsing/location.ts';
import { checkSemantics } from './core/parsing/semantic/index.ts';
import type { ParsedJDLApplications } from './core/parsing/types/parsed.ts';
import type { JDLRuntime } from './core/parsing/types/runtime.ts';
import logger from './core/utils/objects/logger.ts';

export type { JDLFiles };

/** The application the entities of a jdl without application are imported into. */
export type ImportTarget = {
  applicationName?: string;
  applicationType?: ApplicationType;
};

/**
 * The semantic rules report every problem of the jdl, with its position: the warnings are logged, the errors thrown together;
 * the converters take a jdl without any error.
 */
export function checkSemanticErrors(content: ParsedJDLApplications, runtime: JDLRuntime) {
  const diagnostics = checkSemantics(content, runtime);
  for (const warning of diagnostics.filter(diagnostic => diagnostic.severity === 'warning')) {
    logger.warn(`${warning.message}${errorLocation(warning.location)}`);
  }
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map(error => `${error.message}${errorLocation(error.location)}`).join('\n'));
  }
}
