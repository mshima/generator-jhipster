import type { JHipsterCommandDefinition } from '../base/command/index.js';

const command: JHipsterCommandDefinition = {
  arguments: {
    appsFolders: {
      type: Array,
      description: 'Application folders',
    },
  },
  options: {},
};

export default command;
