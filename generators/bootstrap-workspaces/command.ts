import type { JHipsterCommandDefinition } from '../../lib/command/index.js';

const command: JHipsterCommandDefinition = {
  configs: {
    customWorkspacesConfig: {
      cli: {
        type: Boolean,
        hide: true,
      },
      description: 'Use custom configuration',
      scope: 'generator',
    },
  },
};

export default command;
