#!/usr/bin/env node
// Records in dist/build-info.json, exported as generator-jhipster/build-info.json, the commit generator-jhipster is
// prepared from, when it is prepared at the root of a git clone (an install from git runs prepare): such an install has
// the version alone otherwise. The build-info.json at the root, like the version of JHipster of a build published under
// another version, is merged into it.
const { execFileSync } = require('node:child_process');
const { readFileSync, realpathSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = realpathSync(join(__dirname, '..'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

let buildInfo;
try {
  // Inside the clone of another project, like its node_modules, the commit is not the one of generator-jhipster.
  if (realpathSync(git('rev-parse', '--show-toplevel')) === root) {
    buildInfo = { commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain') !== '' };
  }
} catch {
  // Not in a git clone, or git is not available.
}
let rootBuildInfo;
try {
  rootBuildInfo = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'));
} catch {
  // No build-info.json at the root.
}
if (buildInfo || rootBuildInfo) {
  writeFileSync(join(root, 'dist', 'build-info.json'), `${JSON.stringify({ ...rootBuildInfo, ...buildInfo }, null, 2)}\n`);
}
