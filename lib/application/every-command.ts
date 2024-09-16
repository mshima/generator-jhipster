import serverCommand from '../../generators/server/command.js';
import springBootCommand from '../../generators/spring-boot/command.js';
import type { JHipsterConfigs } from '../command/types.js';

export default {
  ...serverCommand.configs,
  ...springBootCommand.configs,
} as const satisfies JHipsterConfigs;
