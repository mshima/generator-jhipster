/**
 * Copyright 2013-2021 the original author or authors from the JHipster project.
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
const BaseBlueprintGenerator = require('../generator-base-blueprint');
const { printSuccess } = require('../../cli/utils');
const { JDLProcessor } = require('../../cli/import-jdl');
const { downloadJDLs } = require('../../cli/jdl');

module.exports = class extends BaseBlueprintGenerator {
  constructor(args, opts) {
    super(args, opts);

    this.argument('jdlFiles', { type: Array, required: false });

    if (this.options.help) return;

    this.useBlueprints = !this.fromBlueprint && this.instantiateBlueprints('jdl');
  }

  _initializing() {
    return {
      async downloadJDLs(...jdlFiles) {
        if (this.options.inline) return;
        this.jdlFiles = await downloadJDLs(jdlFiles, this.options);
      },
      parseJDL() {
        this.jdlImporter = new JDLProcessor(this.jdlFiles, this.options.inline, this.options.commandOptions);
      },
      importJDL() {
        this.jdlImporter.importJDL();
      },
      insight() {
        this.jdlImporter.sendInsight();
      },
    };
  }

  get initializing() {
    return this.useBlueprints ? undefined : this._initializing();
  }

  _configuring() {
    return {
      config() {
        this.jdlImporter.config();
      },
      generateWorkspaces() {
        this.workspaces = this.options.workspaces && this.jdlImporter.multiplesApplications;
        this.customOptions = {
          skipInstall: this.options.skipInstall || (this.options.monorepository && !this.options.microfrontend),
        };
      },
    };
  }

  get configuring() {
    return this.useBlueprints ? undefined : this._configuring();
  }

  _composing() {
    return {
      generateWorkspaces() {
        if (!this.workspaces) return;
        this.composeWithJHipster('workspaces', {
          ...this.jdlImporter.options,
          workspaces: this.workspaces,
          importState: this.jdlImporter.importState,
        });
      },
    };
  }

  get composing() {
    return this.useBlueprints ? undefined : this._composing();
  }

  _install() {
    return {
      generateApplications() {
        return this.jdlImporter.generateApplications(this.customOptions);
      },
      generateEntities() {
        return this.jdlImporter.generateEntities();
      },
      generateDeployments() {
        return this.jdlImporter.generateDeployments(this.customOptions);
      },
    };
  }

  get install() {
    return this.useBlueprints ? undefined : this._install();
  }

  _end() {
    return {
      printSuccess() {
        printSuccess();
      },
    };
  }

  get end() {
    return this.useBlueprints ? undefined : this._end();
  }
};
