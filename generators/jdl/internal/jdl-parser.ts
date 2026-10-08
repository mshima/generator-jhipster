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
import { type JDLConvertibleDefinitions, type JDLDiagnostic, type JDLDocument, type JDLRuntime, createRuntime, parseJDL } from 'jdl-parser';
import { astToFiles } from 'jdl-parser/jhipster';

import type { JDLDefinitions } from '../../../lib/jdl/core/parsing/types/parsing.ts';
import logger from '../../../lib/jdl/core/utils/objects/logger.ts';
import { getDefaultJDLDefinitions } from '../../../lib/jdl-parser/index.ts';

/**
 * The jdl-parser runtime of the definitions of the jdl: the JHipster ones of this generator, in the format of jdl-parser,
 * completing those passed, which may be in the format of generator-jhipster (`createRuntime` converts them).
 */
export const createJDLParserRuntime = (definitions: Partial<JDLDefinitions> = {}): JDLRuntime => {
  const defaults = getDefaultJDLDefinitions();
  return createRuntime({
    application: definitions.application ?? defaults.application,
    deployment: definitions.deployment ?? defaults.deployment,
    entity: definitions.entity ?? defaults.entity,
    relationship: definitions.relationship,
    builtInEntities: definitions.builtInEntities,
    validation: definitions.validation ?? defaults.validation,
    fieldTypes: definitions.fieldTypes ?? defaults.fieldTypes,
    rules: definitions.rules ?? defaults.rules,
  } as unknown as JDLConvertibleDefinitions);
};

/** A diagnostic of jdl-parser with its position, as the jdl importer reports them. */
export const describeDiagnostic = ({ message, location }: JDLDiagnostic): string =>
  `${message}${location ? `\n\tat line: ${location.startLine}, column: ${location.startColumn}` : ''}`;

/**
 * Parses a jdl with jdl-parser: its warnings are logged, its errors thrown together, with their position.
 */
const parseJDLContent = (jdl: string, runtime: JDLRuntime): JDLDocument => {
  if (!jdl) {
    throw new Error('A JDL content must be passed to be converted.');
  }
  const { ast, diagnostics } = parseJDL(jdl, runtime);
  for (const warning of diagnostics.filter(diagnostic => diagnostic.severity === 'warning')) {
    logger.warn(describeDiagnostic(warning));
  }
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  if (errors.length > 0 || !ast) {
    throw new Error(errors.map(describeDiagnostic).join('\n'));
  }
  return ast;
};

/** The json files of a jdl, by path relative to the destination. */
export type JDLJsonFiles = Record<string, Record<string, any>>;

/**
 * Adjusts the json files of a jdl to what the generators still expect from it: the index of each application, its ports
 * derive from, the gateways first, and a service for the entities with a dto, which the generators do not default.
 */
const adjustJDLFiles = (files: JDLJsonFiles): void => {
  const configs = Object.entries(files)
    .filter(([path, content]) => path.endsWith('.yo-rc.json') && !content['generator-jhipster']?.deploymentType)
    .map(([, content]) => content['generator-jhipster']);
  if (configs.length > 1) {
    const isGateway = (config: Record<string, any>) => config.applicationType === 'gateway';
    [...configs.filter(isGateway), ...configs.filter(config => !isGateway(config))].forEach((config, index) => {
      config.applicationIndex = index;
    });
  }
  for (const [path, entity] of Object.entries(files)) {
    if (!path.endsWith('.yo-rc.json') && entity.dto && entity.dto !== 'no' && entity.service === undefined) {
      entity.service = 'serviceClass';
    }
  }
};

/**
 * Converts a jdl to the json files of its applications, entities and deployments, by path relative to the destination:
 * the files of a jdl declaring one application are the ones of the destination, the ones of a jdl declaring several are
 * in a folder for each, the entities of a jdl without application are the ones of the current one. The jdl is checked
 * (`parseJDLContent`), the files adjusted to what the generators still expect (`adjustJDLFiles`). The root `.yo-rc.json`,
 * the jdl as written and the files written from it, is given apart: `filesToAst` merges the files into it.
 */
export const convertJDL = (
  jdl: string,
  runtime: JDLRuntime,
): { ast: JDLDocument; files: JDLJsonFiles; rootYoRc: Record<string, any> | undefined } => {
  const ast = parseJDLContent(jdl, runtime);
  // The jdl as written, at the root of the files, is no file of the project.
  const {
    files: { '.yo-rc.json': rootYoRc, ...files },
    relativeRoot,
  } = astToFiles(ast, runtime);
  adjustJDLFiles(files);
  const prefix = ast.body.some(statement => statement.type === 'Application') && relativeRoot ? `${relativeRoot}/` : '';
  return {
    ast,
    files: Object.fromEntries(
      Object.entries(files).map(([path, content]) => [prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path, content]),
    ),
    rootYoRc,
  };
};
