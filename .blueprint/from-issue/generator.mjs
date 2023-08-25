import { Octokit } from 'octokit';
import { setOutput,  } from '@actions/core';
import BaseGenerator from '../../generators/base/index.mjs';
import command from './command.mjs';
import { promptSamplesFolder } from '../support.mjs';
import { join } from 'path';
import { GENERATOR_APP, GENERATOR_JDL } from '../../generators/generator-list.mjs';
import { GENERATOR_JHIPSTER } from '../../generators/generator-constants.mjs';
import { CLI_NAME } from '../../cli/utils.mjs';
import EnvironmentBuilder from '../../cli/environment-builder.mjs';

const YO_RC_OUTPUT = 'yo-rc';
const ENTITIES_JDL_OUTPUT = 'entities-jdl';
const RESULT_OUTPUT = 'result';

const BLANK = 'blank';
const OK = 'ok';
const ERROR = 'error';
const SUCCESS = 'success';

export default class extends BaseGenerator {
  issue;
  projectFolder;
  owner;
  codeWorkspace;
  repository;
  yoRcContent;
  jdlEntities;

  get [BaseGenerator.INITIALIZING]() {
    return this.asInitializingTaskGroup({
      async initializeOptions() {
        this.parseJHipsterArguments(command.arguments);
        this.parseJHipsterOptions(command.options);
      },
    });
  }

  get [BaseGenerator.PROMPTING]() {
    return this.asPromptingTaskGroup({
      async promptOptions() {
        if (this.codeWorkspace) {
          await promptSamplesFolder.call(this);
        }
      },
    });
  }

  get [BaseGenerator.DEFAULT]() {
    return this.asDefaultTaskGroup({
      async generateSample() {
        const octokit = new Octokit();
        const issue = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
          owner: this.owner,
          repo: this.repository,
          issue_number: this.issue,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        const regexp = /<summary>(?<title>(?:(?!<\/summary>).)+)<\/summary>\s+<pre>(?<body>(?:(?!<\/pre>).)+)/gs;
        let match;
        while ((match = regexp.exec(issue.data.body)) !== null) {
          if (match.groups.title.includes('.yo-rc.json file')) {
            try {
              if (match.groups.body) {
                this.yoRcContent = JSON.parse(match.groups.body);
                setOutput(YO_RC_OUTPUT, OK);
              } else {
                setOutput(YO_RC_OUTPUT, BLANK);
              }
            } catch {
              setOutput(YO_RC_OUTPUT, ERROR);
            }
          } else if (match.groups.title.includes('JDL entity definitions')) {
            this.jdlEntities = match.groups.body?.trim();
            setOutput(ENTITIES_JDL_OUTPUT, this.jdlEntities ? OK : BLANK);
          }
        }

        this.projectFolder = this.projectFolder ?? join(this._globalConfig.get('samplesFolder'), `issues/${this.issue}`);
        if (this.yoRcContent) {
          const yoRcFile = join(this.projectFolder, '.yo-rc.json');
          try {
            const { jwtSecretKey } = this.readDestinationJSON(yoRcFile)?.[GENERATOR_JHIPSTER];
            this.yoRcContent.jwtSecretKey = jwtSecretKey;
          } catch {}

          this.writeDestinationJSON(yoRcFile, { [GENERATOR_JHIPSTER]: this.yoRcContent });
        }
        if (this.jdlEntities) {
          this.writeDestination(this.destinationPath(this.projectFolder, 'entities.jdl'), this.jdlEntities);
        }
      },
    });
  }

  get [BaseGenerator.END]() {
    return this.asEndTaskGroup({
      async generateSample() {
        if (this.jdlEntities) {
          try {
            await this.runNonInteractive({
              cwd: this.projectFolder,
              inline: this.jdlEntities,
              generatorOptions: {
                jsonOnly: true,
              },
            });
          } catch (error) {
            setOutput(ENTITIES_JDL_OUTPUT, ERROR);
            throw error;
          }
        }
        if (this.yoRcContent) {
          await this.runNonInteractive({ cwd: this.projectFolder, generatorOptions: { withEntities: true } });
        }
        setOutput(RESULT_OUTPUT, SUCCESS);

        if (this.codeWorkspace) {
          await this.composeWithJHipster('@jhipster/jhipster-dev:code-workspace', {
            generatorOptions: {
              samplePath: this.projectFolder,
            },
          });
        }
      },
    });
  }

  async runNonInteractive({ cwd, inline, generatorOptions: customOptions }) {
    const envOptions = { cwd, logCwd: this.destinationPath() };
    const generatorOptions = { ...this.options, skipPriorities: ['prompting'], skipInstall: true, inline, ...customOptions };
    delete generatorOptions.configOptions;
    delete generatorOptions.sharedData;
    const envBuilder = await EnvironmentBuilder.createDefaultBuilder(envOptions);
    const env = envBuilder.getEnvironment();
    await env.run([`${CLI_NAME}:${inline ? GENERATOR_JDL : GENERATOR_APP}`], generatorOptions);
  }
}
