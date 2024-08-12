import { writeFileSync } from 'fs';
import { extname, relative } from 'path';
import { passthrough } from '@yeoman/transform';
import { transform } from 'p-transform';
import vue from 'eslint-plugin-vue';

import { defaultHelpers as helpers } from '../../../lib/testing/index.js';
import BaseApplicationGenerator from '../../../generators/base-application/index.js';
import { ESLintPool, PrettierPool, isPrettierConfigFilePath } from '../../../generators/bootstrap/support/index.js';
import { getPackageRoot } from '../../../lib/index.js';
import { ApplyPatchPool } from './apply-patch-pool.js';

const applyPrettier = false;
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
  'import/order': 'off',
};

const vueEslintRules = Object.fromEntries(
  vue.configs['flat/recommended']
    .map(({ rules }) => rules)
    .filter(Boolean)
    .map(rules => Object.entries(rules))
    .flat(),
);

const vueRulesWithFix = [
  'vue/no-deprecated-data-object-declaration',
  'vue/no-deprecated-destroyed-lifecycle',
  'vue/no-deprecated-dollar-scopedslots-api',
  'vue/no-deprecated-scope-attribute',
  'vue/no-deprecated-slot-attribute',
  'vue/no-deprecated-slot-scope-attribute',
  'vue/no-deprecated-v-bind-sync',
  'vue/no-deprecated-v-on-number-modifiers',
  'vue/no-ref-as-operand',
  'vue/no-shared-component-data',
  'vue/prefer-import-from-vue',
  'vue/require-prop-type-constructor',
  'vue/valid-next-tick',
  'vue/attribute-hyphenation',
  'vue/component-definition-name-casing',
  // 'vue/first-attribute-linebreak',
  // 'vue/html-closing-bracket-newline',
  // 'vue/html-closing-bracket-spacing',
  // 'vue/html-end-tags',
  // 'vue/html-indent',
  // 'vue/html-quotes',
  // 'vue/html-self-closing',
  // 'vue/max-attributes-per-line',
  // 'vue/multiline-html-element-content-newline',
  'vue/mustache-interpolation-spacing',
  'vue/no-multi-spaces',
  'vue/no-spaces-around-equal-signs-in-attribute',
  // 'vue/singleline-html-element-content-newline',
  'vue/v-bind-style',
  'vue/v-on-event-hyphenation',
  'vue/v-on-style',
  'vue/v-slot-style',
  'vue/attributes-order',
  'vue/component-tags-order',
  'vue/order-in-components',
  'vue/this-in-template',
];

export const applyChanges = async (config, { contextSize, fuzzFactor }) => {
  const missingTemplates = [];
  const colored = [];
  await helpers
    .run('prettify:app')
    .withOptions({ applyPrettier, skipChecks: true, skipPrettier: true })
    .withJHipsterConfig(config)
    .commitFiles()
    .withJHipsterLookup()
    .withGenerators([
      [
        class extends BaseApplicationGenerator {
          get [BaseApplicationGenerator.DEFAULT]() {
            return this.asDefaultTaskGroup({
              async task() {
                await this.composeWithJHipster('app');

                if (this.options.applyPrettier) {
                  this.queueTransformStream(
                    { filter: file => isPrettierConfigFilePath(file.path), pendingFiles: false },
                    passthrough(file => {
                      writeFileSync(file.path, file.contents);
                    }),
                  );
                }

                const eslint = new ESLintPool({ filename: new URL('./vue-eslint-worker.js', import.meta.url).href });
                const prettier = new PrettierPool();
                const applyPatch = new ApplyPatchPool();

                this.queueTransformStream(
                  { refresh: true },
                  transform(
                    async file => {
                      const fileContents = file.contents.toString();
                      const extension = extname(file.path);
                      if (!file.history) return;
                      const [templateFile] = file.history;
                      if (!templateFile) {
                        missingTemplates.push(file.path);
                        return;
                      }
                      if (
                        ['.json', '.md', '.yml', '.svg', '.png', '.gif', '.xml', '.ico', '.txt', '.webapp', '', '.properties'].includes(
                          extension,
                        ) ||
                        templateFile.includes('.jhi.')
                      ) {
                        return;
                      }

                      let success;
                      let failures;
                      if (!['.java', '.html', '.scss', '.css'].includes(extension)) {
                        const vueFile = extension === '.vue';
                        const eslintRulesToApply = vueFile ? { ...vueEslintRules, ...eslintRules } : eslintRules;
                        for (const [key, value] of Object.entries(eslintRulesToApply)) {
                          if (['off', 0].includes(value)) {
                            continue;
                          }
                          if (key.startsWith('vue/') && !vueRulesWithFix.includes(key)) {
                            continue;
                          }
                          const eslintResult = await eslint.apply({
                            recreateEslint: true,
                            cwd: this.destinationPath(),
                            filePath: file.path,
                            fileContents,
                            extensions: 'cjs,js,mjs,ts,cts,mts,vue',
                            config: JSON.stringify({ rules: { [key]: value } }),
                          });
                          if (eslintResult.error) {
                            throw new Error(eslintResult.error);
                          }
                          if (eslintResult.result !== fileContents) {
                            const result = await applyPatch.apply({
                              templateFile,
                              fileContents,
                              modifiedContents: eslintResult.result,
                              contextSize,
                              fuzzFactor,
                            });
                            success = +result.success;
                            failures = +result.failures;
                          }
                        }
                      }

                      if (applyPrettier) {
                        const prettified = await prettier.apply({
                          relativeFilePath: relative(this.destinationPath(), file.path),
                          filePath: file.path,
                          fileContents,
                          prettierJava: extension === '.java',
                        });
                        if (prettified.result && prettified.result !== fileContents) {
                          const result = await applyPatch.apply({
                            templateFile,
                            fileContents,
                            modifiedContents: prettified.result,
                            contextSize,
                            fuzzFactor,
                          });
                          success = +result.success;
                          failures = +result.failures;
                        }
                      }
                      if (success || failures) {
                        colored.push([
                          { message: '  ' },
                          { color: 'create', message: success ? `${success}` : ' ' },
                          { message: ' ' },
                          { color: 'conflict', message: failures ? `${failures}` : ' ' },
                          { message: ` ${relative(getPackageRoot(), templateFile)}\n` },
                        ]);
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
        },
        'prettify:app',
      ],
    ]);

  return { missingTemplates, colored };
};
