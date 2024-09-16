import type { Simplify } from 'type-fest';
import type { ExtractOptionValuesfromConfigs, JHipsterConfigs } from './types.js';
import { upperFirst } from 'lodash-es';

export const extractOptionValuesFromConfig = <const Configs extends JHipsterConfigs>(
  configs: Configs,
): Simplify<ExtractOptionValuesfromConfigs<Configs>> => {
  const withChoices = Object.entries(configs)
  .filter(([_name, config]) => config.choices);
  return {
    ...Object.fromEntries(withChoices.map(([name]) => [`${name}Option`, name])),
    ...Object.fromEntries(withChoices.map(([name, config]) => config.choices!.map(choice => (typeof choice === 'string' ? choice : choice.value)).map(choice =>[
        `${name}Value${upperFirst(choice)}`,
        choice,
      ])).flat(),
  )
  } as any;
};
