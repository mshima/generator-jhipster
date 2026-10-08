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

import chalk from 'chalk';
import { filesToAst } from 'jdl-parser/jhipster';

import { CommandCoreGenerator } from '../base-core/generator.ts';
import CoreGenerator from '../base-core/index.ts';
import { createJDLParserRuntime, describeDiagnostic, readJDLJsonFiles, resolveJDLDefinitions } from '../jdl/internal/index.ts';

import type command from './command.ts';

export default class extends CommandCoreGenerator<typeof command> {
  jdlFile!: string;
  jdlContent?: string;

  get [CoreGenerator.DEFAULT]() {
    return this.asAnyTaskGroup({
      convertToJDL() {
        // The application of the destination, or the ones of its folders.
        const files = readJDLJsonFiles(this.fs, this.destinationPath());
        if (Object.keys(files).length === 0) {
          return;
        }
        const { jdl, diagnostics, errors } = filesToAst(files, createJDLParserRuntime(resolveJDLDefinitions(this.options)));
        for (const diagnostic of diagnostics.filter(diagnostic => diagnostic.severity !== 'info')) {
          this.log.warn(describeDiagnostic(diagnostic));
        }
        for (const { file, path, message } of errors) {
          this.log.warn(`${file}${path.length > 0 ? ` ${path.join('.')}` : ''}: ${message}`);
        }
        this.jdlContent = jdl;
      },
    });
  }

  get [CoreGenerator.WRITING]() {
    return this.asAnyTaskGroup({
      writeJdl() {
        if (this.jdlContent) {
          this.writeDestination(this.jdlFile, this.jdlContent);
        }
      },
    });
  }

  get [CoreGenerator.END]() {
    return this.asAnyTaskGroup({
      end() {
        this.log.log(chalk.green.bold('\nThe JDL export is complete!\n'));
      },
    });
  }
}
