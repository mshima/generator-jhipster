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

import { lookupConfigsFrom } from '../resolver/lookups.ts';

import type { CommandConfigDefault, JHipsterConfigs } from './types.ts';

type ConfigDefault = { name: string; default: CommandConfigDefault<any> };

const NOT_SET = Symbol('option not set');

/**
 * The storage `default`s of configs, the ones a generator reaches for example.
 */
export const getConfigDefaults = (configs: JHipsterConfigs): ConfigDefault[] =>
  Object.entries(configs)
    .filter(([_name, config]) => config.default !== undefined && (config.scope ?? 'storage') === 'storage')
    .map(([name, config]) => ({ name, default: config.default! }));

/**
 * Fills the undefined values of a configuration with the `default`s.
 *
 * A `default` function receives the configuration being filled, so it may read other options: it is delayed until the
 * options it reads are set, by the configuration or by their own defaults, and computed with what is set at the end
 * otherwise. It returns undefined when the option has no default for this configuration.
 */
export const applyConfigDefaults = <const T extends Record<string, any>>(config: T, defaults: ConfigDefault[]): T => {
  const result: Record<string, any> = { ...config };
  // Reading an option that is not set yet aborts the default, which is retried once other defaults are applied.
  const reader = new Proxy(result, {
    get: (target, property) => {
      const value = target[property as string];
      if (value === undefined) {
        throw NOT_SET;
      }
      return value;
    },
  });
  let pending = defaults.filter(({ name }) => result[name] === undefined);
  let strict = true;
  while (pending.length > 0) {
    const retry: ConfigDefault[] = [];
    for (const entry of pending) {
      if (typeof entry.default !== 'function') {
        result[entry.name] = entry.default;
        continue;
      }
      try {
        const value = entry.default(strict ? reader : result);
        if (value !== undefined) {
          result[entry.name] = value;
        }
      } catch (error) {
        if (error !== NOT_SET) {
          throw error;
        }
        retry.push(entry);
      }
    }
    if (retry.length === pending.length) {
      // Nothing applied in this pass, the remaining defaults read options that are not set: compute them with what is.
      strict = false;
    }
    pending = retry;
  }
  return result as T;
};

let applicationDefaults: ConfigDefault[] | undefined;

/**
 * Fills the undefined values of an application configuration with the defaults the `app` generator reaches, the ones
 * declared by its command and by the commands it imports.
 */
export const getApplicationConfigWithDefaults = <const T extends Record<string, any>>(config: T): T => {
  applicationDefaults ??= getConfigDefaults(lookupConfigsFrom('app'));
  return applyConfigDefaults(config, applicationDefaults);
};
