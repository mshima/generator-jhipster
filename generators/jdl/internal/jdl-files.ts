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
import type { JDLFiles } from '../../../lib/jdl/convert-jdl-to-files.ts';
import { GENERATOR_JHIPSTER, JHIPSTER_CONFIG_DIR } from '../../generator-constants.ts';

/** An application of a jdl to generate: its folder, relative to the destination root, its config and its entities. */
export type JDLApplication = { folder: string; config: Record<string, any>; entityNames: string[] };

const YO_RC = '.yo-rc.json';

/** The folder of a file, relative to the destination root, and its name in that folder. */
const splitFolder = (path: string): [string, string] => {
  if (path === YO_RC || path.startsWith(`${JHIPSTER_CONFIG_DIR}/`)) return ['', path];
  const index = path.indexOf('/');
  return [path.slice(0, index), path.slice(index + 1)];
};

/**
 * The json files of a jdl by path relative to the destination root: the files of the application the generator runs in
 * at the root, the other folders in it.
 * @param relativeRoot - the folder, among the files, of the application the generator runs in.
 */
export const toDestinationFiles = ({ files, relativeRoot }: JDLFiles): Record<string, Record<string, any>> =>
  Object.fromEntries(
    Object.entries(files).map(([path, content]) => [
      relativeRoot && path.startsWith(`${relativeRoot}/`) ? path.slice(relativeRoot.length + 1) : path,
      content,
    ]),
  );

/** Whether a `.yo-rc.json` content is the one of a deployment. */
export const isDeploymentConfig = (content: Record<string, any>): boolean => Boolean(content[GENERATOR_JHIPSTER]?.deploymentType);

/**
 * What the json files of a jdl, by path relative to the destination root, ask to generate: the applications, the entities
 * of a jdl without application, and the folders of the deployments.
 */
export function readGenerationTargets(files: Record<string, Record<string, any>>) {
  const applications = new Map<string, JDLApplication>();
  const deploymentFolders: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    const [folder, name] = splitFolder(path);
    if (name !== YO_RC) continue;
    if (isDeploymentConfig(content)) {
      deploymentFolders.push(folder);
    } else {
      applications.set(folder, { folder, config: content[GENERATOR_JHIPSTER], entityNames: [] });
    }
  }
  /** The entities of a jdl without application, of the current application. */
  const entityNames: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    const [folder, name] = splitFolder(path);
    if (!name.startsWith(`${JHIPSTER_CONFIG_DIR}/`)) continue;
    const application = applications.get(folder);
    (application ? application.entityNames : entityNames).push(content.name);
  }
  return { applications: [...applications.values()], entityNames, deploymentFolders };
}
