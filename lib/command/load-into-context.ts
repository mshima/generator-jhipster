import { upperFirst } from 'lodash-es';
import type { CommandConfigScope, JHipsterConfigs } from './types.js';

export const loadConfigIntoContext = (options: {
  config?: Record<string, any>;
  context: Record<string, any>;
  commandsConfigs: JHipsterConfigs;
  scopes: CommandConfigScope[];
}) => {
  const { config, context, commandsConfigs, scopes = ['storage', 'blueprint'] } = options;
  if (commandsConfigs) {
    Object.entries(commandsConfigs)
      .filter(([_key, def]) => scopes.includes(def.scope!))
      .forEach(([key, def]) => {
        const configuredValue = config?.[key] ?? context[key];
        context[key] = context[key] ?? configuredValue;
        key = key === 'serviceDiscoveryType' ? 'serviceDiscovery' : key;
        if (def.choices) {
          const hasConfiguredValue = configuredValue !== undefined && configuredValue !== null;
          for (const choice of def.choices) {
            const choiceValue = typeof choice === 'string' ? choice : choice.value;
            const choiceKey = `${key}${upperFirst(choiceValue)}`;
            if (hasConfiguredValue) {
              context[choiceKey] = configuredValue === choiceValue;
            } else {
              context[choiceKey] = context[choiceKey] ?? undefined;
            }
          }
          context[`${key}Any`] = hasConfiguredValue ? !context[`${key}No`] : undefined;
        }
      });
  }
};
