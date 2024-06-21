import { existsSync, readFileSync, writeFileSync } from 'fs';
import { extname, relative } from 'path';
import { passthrough } from '@yeoman/transform';
import chalk from 'chalk';
import { applyPatch, structuredPatch } from 'diff';
import { isMatch } from 'lodash-es';
import { transform } from 'p-transform';

import { buildServerMatrix, defaultHelpers as helpers } from '../../../testing/index.js';
import BaseApplicationGenerator from '../../../generators/base-application/index.js';
import { ESLintPool, PrettierPool, isPrettierConfigFilePath } from '../../../generators/bootstrap/support/index.js';
import { getPackageRoot } from '../../../lib/index.js';

const applyPrettier = true;
const eslintRules = {
  'dot-notation': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-else-return': 'error',
  'no-regex-spaces': 'error',
  'no-useless-computed-key': 'error',
  'no-useless-return': 'error',
  'no-var': 'error',
  'object-shorthand': 'error',
  'prefer-const': 'error',
  'prefer-destructuring': ['error', { array: false }],
  'prefer-object-has-own': 'error',
  'prefer-object-spread': 'error',
  'prefer-template': 'error',
};

export const applyChanges = async (gen, commonConfig) => {
  for (const [sample, config] of Object.entries(buildServerMatrix())) {
    if (
      isMatch(config, { websocket: true, applicationType: 'gateway' }) ||
      isMatch(config, { websocket: true, applicationType: 'microservice' })
    ) {
      config.websocket = false;
    }

    gen.log.verboseInfo(`Applying to ${sample}`);
    await helpers
      .run('prettify:app')
      .withOptions({ applyPrettier: true, skipChecks: true })
      .withJHipsterConfig({ ...config, ...commonConfig })
      .commitFiles()
      .withJHipsterLookup()
      .withGenerators([
        [
          class extends BaseApplicationGenerator {
            get [BaseApplicationGenerator.DEFAULT]() {
              return this.asDefaultTaskGroup({
                async task({ application }) {
                  await this.composeWithJHipster('app');

                  // Create source map for reference
                  application.customizeTemplatePaths.push(file => {
                    const memFsFile = this.env.sharedFs.get(this.destinationPath(file.destinationFile));
                    memFsFile.sourceFile = existsSync(file.resolvedSourceFile) ? file.resolvedSourceFile : `${file.resolvedSourceFile}.ejs`;
                    return file;
                  });

                  if (this.options.applyPrettier) {
                    this.queueTransformStream(
                      { filter: file => isPrettierConfigFilePath(file.path), pendingFiles: false },
                      passthrough(file => {
                        writeFileSync(file.path, file.contents);
                      }),
                    );
                  }

                  const eslint = new ESLintPool();
                  const prettier = new PrettierPool();

                  this.queueTransformStream(
                    { refresh: true },
                    passthrough(file => {
                      file.oldContents = file.contents;
                    }),
                    transform(
                      async file => {
                        const fileContents = file.contents.toString();
                        const extension = extname(file.path);
                        const templateFile = file.sourceFile;
                        if (!templateFile) {
                          gen.log.debug(chalk.yellow('missing template file'), file.path);
                          return;
                        }
                        if (!['.json', '.md', '.yml'].includes(extension) && !templateFile.includes('.jhi.')) {
                          if (applyPrettier) {
                            const prettified = await prettier.apply({
                              relativeFilePath: relative(this.destinationPath(), file.path),
                              filePath: file.path,
                              fileContents,
                              prettierJava: extension === '.java',
                            });
                            if (prettified.result) {
                              this.applyDiff({ templateFile, fileContents, modifiedContents: prettified.result });
                            }
                          }

                          if (!['.java'].includes(extension)) {
                            for (const key of Object.keys(eslintRules)) {
                              const eslintResult = await eslint.apply({
                                cwd: this.destinationPath(),
                                filePath: file.path,
                                fileContents,
                                extensions: 'cjs,js,mjs,ts',
                                config: JSON.stringify({ rules: { [key]: eslintRules[key] } }),
                              });
                              const patch = this.applyDiff({
                                templateFile,
                                fileContents,
                                modifiedContents: eslintResult.result,
                                contextSize: 1,
                              });
                              if (patch) {
                                for (const hunks of patch.hunks) {
                                  gen.log.info(hunks);
                                }
                              }
                            }
                          }
                        }
                      },
                      () => {
                        this.cancelCancellableTasks();
                        eslint.destroy();
                        prettier.destroy();
                      },
                    ),
                  );
                },
              });
            }

            applyDiff({ templateFile, fileContents, modifiedContents, contextSize = 2 }) {
              if (fileContents === modifiedContents) return undefined;
              const patch = structuredPatch(templateFile, templateFile, fileContents, modifiedContents, undefined, undefined, {
                context: contextSize,
                newlineIsToken: false,
              });
              patch.hunks = patch.hunks
                .map(({ lines, ...remainning }) => ({
                  ...remainning,
                  lines: lines
                    .map(line => (line === '-' ? ' ' : line.replace('-import', ' import').replace('+import', ' import')))
                    .filter(line => line !== '+'),
                }))
                .filter(({ lines }) => lines.some(line => line.startsWith('+') || line.startsWith('-')));
              // apply hunk by hunk, since if a hunk fails, the rest of the file will be skipped
              for (const hunk of patch.hunks) {
                // console.log(hunk);
                const content = readFileSync(templateFile, 'utf8').toString();
                const applied = applyPatch(
                  content,
                  { ...patch, hunks: [hunk] },
                  {
                    fuzzFactor: 0,
                    compareLine: (lineNumber, line, operation, patchContent) => {
                      return line?.trim() === patchContent?.trim();
                    },
                  },
                );
                const packageRoot = getPackageRoot();
                const relativePath = relative(packageRoot, templateFile);
                if (applied) {
                  writeFileSync(templateFile, applied);
                  gen.log.ok(relativePath);
                } else {
                  gen.log.colored([{ message: '  ' }, { color: 'conflict', message: 'fail' }, { message: ` ${relativePath}\n` }]);
                }
              }
              return patch;
            }
          },
          'prettify:app',
        ],
      ]);
  }
};
