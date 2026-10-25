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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What `build-info.json` tells of a build of generator-jhipster: the commit it is built from (bin/build-info.cjs), and the
 * version of JHipster it is when it is published under another version, like a build published under another name.
 */
export type BuildInfo = {
  commit?: string;
  dirty?: boolean;
  /** The version of JHipster, which the version of the package.json, the one npm installs, is then not. */
  version?: string;
};

/** The `build-info.json` of a folder: undefined when it has none. */
export const readBuildInfo = (folder: string): BuildInfo | undefined => {
  try {
    return JSON.parse(readFileSync(join(folder, 'build-info.json'), 'utf8'));
  } catch {
    return undefined;
  }
};
