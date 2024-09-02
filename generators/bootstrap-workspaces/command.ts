import type { JHipsterCommandDefinition } from '../base/command/index.js';

const command: JHipsterCommandDefinition = {
  options: {
    customWorkspacesConfig: {
      type: Boolean,
      description: 'Use custom configuration',
      scope: 'generator',
      hide: true,
    },
  },
};

export default command;
