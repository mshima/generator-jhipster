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
import { uniqBy } from 'lodash-es';

import { APPLICATION_TYPE_KEY, type ApplicationType } from '../core/application-types.ts';
import { createJDLRuntime, getDefaultRuntime } from '../jdl-config/jdl-runtime.ts';
import { readCurrentPathYoRcFile } from '../utils/yo-rc.ts';

import {
  type ImportTarget,
  type JDLJSON,
  type JDLJSONApplication,
  type JDLJSONEntity,
  astToJson,
} from './converters/ast-to-json/ast-to-json.ts';
import { GENERATOR_NAME } from './converters/exporters/export-utils.ts';
import { exportJSONDeployments } from './converters/exporters/jhipster-deployment-exporter.ts';
import exportEntities from './converters/exporters/jhipster-entity-exporter.ts';
import { errorLocation } from './core/parsing/location.ts';
import { checkSemantics } from './core/parsing/semantic/index.ts';
import type { ParsedJDLApplications } from './core/parsing/types/parsed.ts';
import type { JDLApplicationConfig, JDLDefinitions } from './core/parsing/types/parsing.ts';
import type { JDLRuntime } from './core/parsing/types/runtime.ts';
import { parseFromContent, parseFromFiles } from './core/readers/jdl-reader.ts';
import type { JDLJSONBlueprint, JDLJSONMicrofrontend, PostProcessedJDLJSONApplication } from './core/types/exporter.ts';
import type { JSONEntity } from './core/types/json-config.ts';
import logger from './core/utils/objects/logger.ts';

const GENERATOR_JHIPSTER = 'generator-jhipster'; // can't use the one of the generator as it circles

type JDLApplicationConfiguration = {
  applicationName?: string;
  applicationType?: ApplicationType;
  application?: {
    [GENERATOR_JHIPSTER]: {
      baseName?: string;
      applicationType?: ApplicationType;
    };
  };
  forSeveralApplications?: boolean;
  /**
   * Returns the deployments without writing their `.yo-rc.json` files, letting the caller write them through its
   * own file system. Deployment files are written to the disk otherwise.
   */
  skipDeploymentFileGeneration?: boolean;
};

/**
 * The definitions of an importer: the application options of a generator, the JHipster definitions completing the others;
 * or definitions, the JHipster ones completing those not passed.
 */
export type JDLImporterDefinitions = JDLApplicationConfig | Partial<JDLDefinitions>;

const getRuntime = (definitions?: JDLImporterDefinitions): JDLRuntime => {
  if (!definitions) return getDefaultRuntime();
  return createJDLRuntime('validatorConfig' in definitions ? { application: definitions } : definitions);
};

/**
 * Creates a new JDL importer from files.
 * There are two ways to create an importer:
 *   - By providing an existing application content, if there's one
 *   - Deprecated: providing some application options
 */
export function createImporterFromFiles(
  files: string[],
  configuration?: JDLApplicationConfiguration,
  definitions?: JDLImporterDefinitions,
) {
  if (!files) {
    throw new Error('Files must be passed to create a new JDL importer.');
  }
  const runtime = getRuntime(definitions);
  const content = parseFromFiles(files, runtime);
  return makeJDLImporter(content, configuration ?? {}, runtime);
}

/**
 * Creates a new JDL importer from a JDL string content.
 * There are two ways to create an importer:
 *   - By providing an existing application content, if there's one
 *   - Deprecated: providing some application options
 */
export function createImporterFromContent(
  jdlString: string,
  configuration?: JDLApplicationConfiguration,
  definitions?: JDLImporterDefinitions,
) {
  if (!jdlString) {
    throw new Error('A JDL content must be passed to create a new JDL importer.');
  }
  const runtime = getRuntime(definitions);
  const content = parseFromContent(jdlString, runtime);
  return makeJDLImporter(content, configuration ?? {}, runtime);
}

export type ApplicationWithEntities = {
  config: {
    blueprints?: JDLJSONBlueprint[];
    microfrontends?: JDLJSONMicrofrontend[];
  } & Record<string, any>;
  namespaceConfigs?: Record<string, Record<string, any>>;
  entities: JSONEntity[];
};

export type ImportState = {
  exportedApplications: PostProcessedJDLJSONApplication[];
  exportedApplicationsWithEntities: Record<string, ApplicationWithEntities>;
  exportedEntities: JSONEntity[];
  exportedDeployments: any[];
};

function makeJDLImporter(content: ParsedJDLApplications, configuration: JDLApplicationConfiguration, runtime: JDLRuntime) {
  let importState: ImportState = {
    exportedApplications: [],
    exportedApplicationsWithEntities: {},
    exportedEntities: [],
    exportedDeployments: [],
  };

  return {
    /**
     * Processes JDL files and converts them to JSON.
     * @returns {object} the state of the process:
     *          - exportedDeployments: the exported deployments, or an empty list
     *          - exportedApplications: the exported applications, or an empty list
     *          - exportedEntities: the exported entities, or an empty list
     */
    import: () => {
      checkSemanticErrors(content, runtime);
      const json = astToJson(content, getImportTarget(configuration), runtime);
      importState = importApplications(json.applications, configuration);
      if (content.deployments.length > 0) {
        importState.exportedDeployments = importDeployments(json.deployments, configuration);
      }
      return importState;
    },
  };
}

/** The application a jdl without application is imported into. */
function getImportTarget(configuration: JDLApplicationConfiguration): ImportTarget {
  let baseName = configuration.applicationName;
  let { applicationType } = configuration;

  if (configuration.application) {
    baseName ??= configuration.application[GENERATOR_JHIPSTER].baseName;
    applicationType ??= configuration.application[GENERATOR_JHIPSTER].applicationType;
  }
  return { applicationName: baseName, applicationType };
}

/**
 * The semantic rules report every problem of the jdl, with its position: the warnings are logged, the errors thrown together;
 * the converters take a jdl without any error.
 */
function checkSemanticErrors(content: ParsedJDLApplications, runtime: JDLRuntime) {
  const diagnostics = checkSemantics(content, runtime);
  for (const warning of diagnostics.filter(diagnostic => diagnostic.severity === 'warning')) {
    logger.warn(`${warning.message}${errorLocation(warning.location)}`);
  }
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map(error => `${error.message}${errorLocation(error.location)}`).join('\n'));
  }
}

/**
 * Exports the entities of each application, merged with those on the disk. The application a jdl without application is
 * imported into gives only its entities; the applications without entities come last.
 */
function importApplications(applications: JDLJSONApplication[], configuration: JDLApplicationConfiguration): ImportState {
  const declared = applications.filter(application => application.config);
  const importState: ImportState = {
    exportedApplications: declared.map(application => application.config!),
    exportedApplicationsWithEntities: {},
    exportedEntities: [],
    exportedDeployments: [],
  };
  const ordered = [
    ...applications.filter(application => application.entities.length > 0),
    ...applications.filter(application => application.entities.length === 0),
  ];
  for (const { config: yoRc, entities } of ordered) {
    if (!yoRc) {
      checkImportApplicationName(configuration);
      importState.exportedEntities = exportJSONEntities(entities, configuration);
      continue;
    }
    const { [GENERATOR_NAME]: config, ...remaining } = yoRc;
    const applicationName = config.baseName!;
    const exportedJSONEntities =
      entities.length > 0 ?
        exportJSONEntities(entities, {
          applicationName,
          applicationType: config[APPLICATION_TYPE_KEY],
          forSeveralApplications: declared.length > 1,
        })
      : [];
    importState.exportedApplicationsWithEntities[applicationName] = { config, ...remaining, entities: exportedJSONEntities };
    importState.exportedEntities = uniqBy([...importState.exportedEntities, ...exportedJSONEntities], 'name');
  }
  return importState;
}

/** The entities of a jdl without application are imported into an application, which must be named. */
function checkImportApplicationName(configuration: JDLApplicationConfiguration) {
  let { applicationName } = configuration;

  let { application } = configuration;
  application ??= readCurrentPathYoRcFile();
  if (application?.[GENERATOR_JHIPSTER]) {
    applicationName ??= application[GENERATOR_JHIPSTER].baseName;
  }
  if (!applicationName) {
    throw new Error("The JDL object and its application's name are mandatory.");
  }
}

function importDeployments(deployments: JDLJSON['deployments'], configuration: JDLApplicationConfiguration) {
  // A deployment type declared twice keeps the place of the first one and the definition of the last one.
  const byType = new Map(deployments.map(deployment => [deployment[GENERATOR_NAME]!.deploymentType, deployment]));
  return exportJSONDeployments([...byType.values()], { skipFileGeneration: configuration.skipDeploymentFileGeneration });
}

function exportJSONEntities(entities: JDLJSONEntity[], configuration: JDLApplicationConfiguration): JSONEntity[] {
  let baseName = configuration.applicationName;
  let { applicationType } = configuration;

  if (configuration.application) {
    ({ baseName, applicationType } = configuration.application[GENERATOR_JHIPSTER]);
  }

  return exportEntities({
    entities: entities as any,
    application: {
      name: baseName!,
      type: applicationType!,
      forSeveralApplications: !!configuration.forSeveralApplications,
    },
  });
}
