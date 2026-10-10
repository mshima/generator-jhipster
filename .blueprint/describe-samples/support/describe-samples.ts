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
import { statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';

import { globSync } from 'tinyglobby';

import {
  type BaseSampleDescription,
  type GitHubMatrix,
  type SampleDescription,
  type WorkflowSample,
  convertToGitHubMatrix,
  describeGithubSamples,
  readSampleConfig,
  sampleMatrixOf,
} from '../../../lib/ci/index.ts';
import { getPackageRoot } from '../../../lib/index.ts';
import { getWorkflowNames, getWorkflowSamples, isDaily } from '../../generate-sample/support/get-workflow-samples.ts';
import { type ResolvedSample, groupWorkflowSample, resolveSample } from '../../generate-sample/support/resolve-sample.ts';
import { workflowChoices } from '../../github-build-matrix/command.ts';
import { buildDailyWorkflowMatrix, buildWorkflowMatrix } from '../../github-build-matrix/support/workflow-matrix.ts';

export { type SampleDescription, formatSample, formatSamplesList } from '../../../lib/ci/index.ts';

const packageRoot = getPackageRoot();
const relativeToRoot = (file: string) => relative(packageRoot, file);

const describeResolved = (
  resolved: ResolvedSample,
  workflow: string,
  item: GitHubMatrix | undefined,
  command: string,
): SampleDescription => {
  const { sample } = resolved;
  const base: BaseSampleDescription = {
    name: resolved.name,
    workflow,
    jobName: item?.['job-name'] ?? sample?.['job-name'] ?? resolved.name,
    disabled: sample?.disabled ? true : undefined,
    sonar: sample?.['sonar-analyse'] === 'true' ? true : undefined,
    command,
    generatorOptions: sample?.generatorOptions,
    args: sample?.['extra-args'],
    environment: resolved.profile,
    war: resolved.war || undefined,
    matrix: sampleMatrixOf(item),
  };
  if (resolved.generator === 'jdl') {
    return {
      ...base,
      generator: 'jdl',
      jdlSamples: sample?.['jdl-samples'],
      jdlSampleFiles: resolved.jdlSampleFiles.map(relativeToRoot),
    };
  }
  return {
    ...base,
    generator: 'app',
    yoRcFile: resolved.yoRcFile ? relativeToRoot(resolved.yoRcFile) : undefined,
    config: readSampleConfig(resolved.yoRcFile),
    entitiesSample: resolved.entitiesSample,
    entityFiles: resolved.entityFiles.map(relativeToRoot),
    jdlEntity: sample?.['jdl-entity'],
    jdlEntityFiles: resolved.jdlEntityFiles.map(relativeToRoot),
  };
};

/** Samples of the json workflows (`workflow-samples/<workflow>.json`), with the matrix values the workflow computes. */
const describeWorkflowSamples = (workflow: string): SampleDescription[] => {
  const samples: WorkflowSample[] = Object.values(getWorkflowSamples([workflow])[workflow]);
  const group = isDaily(workflow) ? buildDailyWorkflowMatrix(workflow) : buildWorkflowMatrix(samples);
  const matrix = convertToGitHubMatrix(group, { randomEnvironment: !isDaily(workflow) });
  return samples.map(sample => {
    const jobName = sample['job-name'] ?? sample.name;
    const item = matrix.include.find(entry => entry.sample === jobName);
    const resolved = resolveSample(sample.name);
    return describeResolved(resolved, workflow, item, `jhipster generate-sample ${sample.name}`);
  });
};

/** Samples of the group workflows (`github-build-matrix/samples/<workflow>.ts`), a sample folder given with its args. */
const describeGroupSamples = (workflow: string, samplesFolder: string): Promise<SampleDescription[]> =>
  describeGithubSamples({
    samplesGroupFolder: samplesFolder,
    groups: [workflow],
    root: packageRoot,
    describeSample: ({ name, item, matrix }) => {
      if (item.jdl) return undefined;
      // A sample generated from a `.yo-rc.json` folder, by its name only, like generate-sample resolves it.
      const resolved = resolveSample(name, { sample: groupWorkflowSample(name, { group: workflow, sample: item }) });
      return { ...describeResolved(resolved, workflow, matrix, `jhipster generate-sample ${name}`), name, jobName: name };
    },
  });

/** Workflows defined by a `workflow-samples/<workflow>.json` file. */
const JSON_WORKFLOWS = new Set(getWorkflowNames());

/** Every described workflow: the group workflows of this repository, then the `daily-` workflows of jhipster-daily-builds. */
export const WORKFLOWS = [...workflowChoices.filter(workflow => workflow !== 'generators'), ...getWorkflowNames().filter(isDaily)];

/**
 * Describe the CI samples: what each job generates and the environment it runs on.
 */
export const describeSamples = async ({
  workflow,
  samplesFolder,
}: {
  workflow?: string;
  samplesFolder: string;
}): Promise<SampleDescription[]> => {
  const workflows = workflow ? [workflow] : WORKFLOWS;
  const descriptions: SampleDescription[] = [];
  for (const currentWorkflow of workflows) {
    descriptions.push(
      ...(JSON_WORKFLOWS.has(currentWorkflow) ?
        describeWorkflowSamples(currentWorkflow)
      : await describeGroupSamples(currentWorkflow, samplesFolder)),
    );
  }
  return descriptions;
};

/** The folder of the samples groups of the group workflows. */
const SAMPLES_FOLDER = join(import.meta.dirname, '../../github-build-matrix/samples/');

/** A samples group, a workflow, with the names of its samples; an object, to grow with more data. */
export type SampleGroupSummary = {
  samples: string[];
};

/** A sample: how to generate it, and the files generate-sample copies to the project, by destination. */
export type SampleSummary = {
  workflow: string;
  jobName: string;
  /** The command that generates the sample. */
  command: string;
  disabled?: boolean;
  /** The files copied to the project but the jdl ones: the path in the project, relative to it, to the file of this repository. */
  files: Record<string, string>;
  /**
   * The jdl the sample is generated from, by their name in the project: a file of this repository, copied, or the
   * content of an inline jdl, given to the jdl generator.
   */
  jdls: Record<string, SampleJDL>;
};

/** A jdl of a sample: a file of this repository, or the content of an inline jdl. */
export type SampleJDL = { file: string } | { content: string };

/** The samples of a samples group by name; an object, to grow with more data. */
export type SampleGroupDescription = {
  samples: Record<string, SampleSummary>;
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** A jdl file copied by its name, or a folder copied with its content, by destination. */
const copiedFilesOf = (sources: string[]): [string, string][] =>
  sources.flatMap(source => {
    const path = join(packageRoot, source);
    if (!isDirectory(path)) return [[basename(source), source]];
    return globSync('**', { cwd: path, dot: true }).map(file => [file, relativeToRoot(join(path, file))] as [string, string]);
  });

/** The files generate-sample copies to the project for a sample, by destination, the jdl ones included. */
const copiedFilesOfSample = (sample: SampleDescription): [string, string][] => {
  if (sample.generator === 'jdl') return copiedFilesOf(sample.jdlSampleFiles);
  if (sample.generator !== 'app') return [];
  return [
    ...(sample.yoRcFile ? [['.yo-rc.json', sample.yoRcFile] as [string, string]] : []),
    ...sample.entityFiles.map(file => [`.jhipster/${basename(file)}`, file] as [string, string]),
    ...copiedFilesOf(sample.jdlEntityFiles),
  ];
};

const isJDL = ([destination]: [string, string]): boolean => extname(destination) === '.jdl';

const summaryOf = (sample: SampleDescription): SampleSummary => ({
  workflow: sample.workflow,
  jobName: sample.jobName,
  command: sample.command,
  disabled: sample.disabled,
  files: Object.fromEntries(copiedFilesOfSample(sample).filter(file => !isJDL(file))),
  jdls: Object.fromEntries([
    ...(sample.generator === 'jdl' && sample.jdl ? [[`${sample.name}.jdl`, { content: sample.jdl }] as [string, SampleJDL]] : []),
    ...copiedFilesOfSample(sample)
      .filter(isJDL)
      .map(([destination, file]) => [destination, { file }] as [string, SampleJDL]),
  ]),
});

/** The samples of a samples group, a workflow, by name. */
export const describeSampleGroup = async (group: string): Promise<SampleGroupDescription> => {
  if (!WORKFLOWS.includes(group)) {
    throw new Error(`Samples group ${group} not found, expected one of ${WORKFLOWS.join(', ')}`);
  }
  const samples = await describeSamples({ workflow: group, samplesFolder: SAMPLES_FOLDER });
  return { samples: Object.fromEntries(samples.map(sample => [sample.name, summaryOf(sample)])) };
};

/** The samples groups, the workflows, by name, with the names of their samples. */
export const describeSampleGroups = async (): Promise<Record<string, SampleGroupSummary>> => {
  const groups: Record<string, SampleGroupSummary> = {};
  for (const name of WORKFLOWS) {
    groups[name] = { samples: Object.keys((await describeSampleGroup(name)).samples) };
  }
  return groups;
};

/** A sample, by its name or its job name, the names being unique across the samples groups. */
export const describeSample = async (name: string): Promise<SampleSummary> => {
  const sample = (await describeSamples({ samplesFolder: SAMPLES_FOLDER })).find(
    description => description.name === name || description.jobName === name,
  );
  if (!sample) {
    throw new Error(`Sample ${name} not found in the ${WORKFLOWS.join(', ')} samples groups`);
  }
  return summaryOf(sample);
};
