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
import { describe, expect, it } from 'esmocha';

import { buildJHipster, resolveStrictMode } from './program.ts';

describe('cli - strict', () => {
  describe('resolveStrictMode', () => {
    it('should default to warn', () => {
      expect(resolveStrictMode(['node', 'jhipster', 'app'])).toBe('warn');
    });
    it('should default to the mode of the cli', () => {
      expect(resolveStrictMode(['node', 'jhipster', 'app'], 'error')).toBe('error');
    });
    it('should take the flag over the mode of the cli', () => {
      expect(resolveStrictMode(['node', 'jhipster', 'app', '--strict', 'off'], 'error')).toBe('off');
      expect(resolveStrictMode(['node', 'jhipster', 'app', '--strict=error'])).toBe('error');
    });
    it('should reject an unknown mode', () => {
      expect(() => resolveStrictMode(['node', 'jhipster', 'app', '--strict', 'bogus'])).toThrow(/Invalid strict mode bogus/);
    });
  });

  describe('buildJHipster with the strict mode error', () => {
    it('should reject a custom environment builder', async () => {
      await expect(buildJHipster({ strict: 'error', createEnvBuilder: async () => ({}) as any })).rejects.toThrow(/createEnvBuilder/);
    });
    it('should reject lookups', async () => {
      await expect(buildJHipster({ strict: 'error', lookups: [{ packagePaths: ['foo'] }] })).rejects.toThrow(/lookups/);
    });
    it('should reject custom jdl definitions', async () => {
      await expect(buildJHipster({ strict: 'error', env: {} as any, commands: {}, getJDLDefinitions: () => ({}) })).rejects.toThrow(
        /getJDLDefinitions/,
      );
    });
  });
});
