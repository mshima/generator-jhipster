import { expect } from 'esmocha';
import { lookupCommandsConfigs } from '../command/lookup-commands-configs.js';
import { extractOptionValuesFromConfig } from '../command/extract-option-values.js';
import optionValues from './option-values.js';

describe('OptionValues', () => {
  it('should match snapshot', () => {
    expect(optionValues).toMatchSnapshot();
  });
  it('should contain every option', async () => {
    const configs = await lookupCommandsConfigs();
    expect(optionValues).toMatchObject(extractOptionValuesFromConfig(configs));
  });
});
