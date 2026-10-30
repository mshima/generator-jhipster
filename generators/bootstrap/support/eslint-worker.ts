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

import eslint from 'eslint';
import { defineConfig } from 'eslint/config';
import java from 'eslint-plugin-java-lang';
import typescript from 'typescript';
import ts from 'typescript-eslint';

import jhipster from '../../../lib/eslint/index.ts';

/** The lints of a file at most, each applying at most 10 passes of fixes. */
const MAX_LINTS = 10;

/** The file being linted, the only one of the program of the language service. */
let typedFile: { filePath: string; contents: string; version: number } | undefined;

const languageService = typescript.createLanguageService(
  {
    getCompilationSettings: () => ({
      target: typescript.ScriptTarget.ESNext,
      module: typescript.ModuleKind.ESNext,
      jsx: typescript.JsxEmit.Preserve,
      // The imports are not resolved: the files are in memory, the dependencies may not be installed.
      noResolve: true,
    }),
    getScriptFileNames: () => (typedFile ? [typedFile.filePath] : []),
    getScriptVersion: fileName => (fileName === typedFile?.filePath ? String(typedFile.version) : '0'),
    getScriptSnapshot: fileName => {
      const contents = fileName === typedFile?.filePath ? typedFile.contents : typescript.sys.readFile(fileName);
      return contents === undefined ? undefined : typescript.ScriptSnapshot.fromString(contents);
    },
    getCurrentDirectory: () => '/',
    getDefaultLibFileName: options => typescript.getDefaultLibFilePath(options),
    fileExists: fileName => fileName === typedFile?.filePath || typescript.sys.fileExists(fileName),
    readFile: fileName => (fileName === typedFile?.filePath ? typedFile.contents : typescript.sys.readFile(fileName)),
  },
  typescript.createDocumentRegistry(),
);

/**
 * Parses a TypeScript file with the program of its contents alone, for the type aware rules of `jhipster.typescript`:
 * the file being generated is not on disk, nor in the program of a tsconfig.
 */
const typedParser: eslint.Linter.Parser = {
  meta: { name: 'jhipster-typed-in-memory' },
  parseForESLint(code: string, options: eslint.Linter.ParserOptions & { filePath: string }) {
    typedFile = { filePath: options.filePath, contents: code, version: (typedFile?.version ?? 0) + 1 };
    return (
      ts.parser as { parseForESLint: (code: string, options: eslint.Linter.ParserOptions) => eslint.Linter.ESLintParseResult }
    ).parseForESLint(code, {
      ...options,
      project: undefined,
      projectService: undefined,
      programs: [languageService.getProgram()!],
    });
  },
};

let eslintInstance: eslint.ESLint;
/** What the instance was created for: a thread of the pool of the process lints the files of several commits. */
let eslintInstanceKey: string | undefined;

export default async ({
  cwd,
  filePath,
  fileContents,
  extensions,
  config,
  additionalConfig = [],
  recreateEslint,
}: {
  cwd?: string;
  filePath: string;
  fileContents: string;
  extensions: string;
  config?: string | null;
  additionalConfig?: eslint.Linter.Config[];
  recreateEslint?: boolean;
}): Promise<{ result: string } | { error: string }> => {
  const instanceKey = JSON.stringify({ cwd, extensions, config, additionalConfig });
  if (recreateEslint || !eslintInstance || instanceKey !== eslintInstanceKey) {
    eslintInstanceKey = instanceKey;
    eslintInstance = new eslint.ESLint({
      fix: true,
      overrideConfigFile: true,
      cache: false,
      cwd,
      baseConfig: defineConfig(
        { files: [`**/*.{${extensions}}`] },
        ts.configs.base,
        ...additionalConfig,
        ...(config ?
          [JSON.parse(config)]
        : [jhipster.base, jhipster.typescript, { files: jhipster.typescript.files, languageOptions: { parser: typedParser } }]),
        {
          linterOptions: {
            reportUnusedDisableDirectives: 'off',
          },
        },
        extensions.split(',').includes('java') ? java.configs.recommended : {},
      ),
    });
  }

  if (await eslintInstance.isPathIgnored(filePath)) {
    return { result: fileContents };
  }
  try {
    let output = fileContents;
    // A lint applies at most 10 passes of fixes: lint again while fixable problems remain, like the import order of a long import block.
    for (let lint = 0; lint < MAX_LINTS; lint++) {
      const [result] = await eslintInstance.lintText(output, { filePath });
      if (result.output === undefined || result.output === output) {
        break;
      }
      ({ output } = result);
      if (result.fixableErrorCount + result.fixableWarningCount === 0) {
        break;
      }
    }
    return { result: output };
  } catch (error) {
    return { error: `${error}` };
  }
};
