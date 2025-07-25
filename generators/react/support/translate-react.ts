/**
 * Copyright 2013-2025 the original author or authors from the JHipster project.
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
import { passthrough } from '@yeoman/transform';
import { Minimatch } from 'minimatch';
import type { MemFsEditorFile } from 'mem-fs-editor';
import type { GetWebappTranslationCallback } from '../../client/translation.js';

const TRANSLATE_IMPORT_1 = /import { ?[T|t]ranslate(?:, ?[T|t]ranslate)? ?} from 'react-jhipster';?/.source; // Translate imports
const TRANSLATE_IMPORT_2 = / *[T|t]ranslate,|, ?[T|t]ranslate/.source; // Translate import
const TRANSLATE_IMPORT = [TRANSLATE_IMPORT_1, TRANSLATE_IMPORT_2].join('|');

const TRANSLATE_FUNCTION = /translate\(\s*'(?<key>[^']+)'(?:,\s*(?<interpolate>\{[^}]*\}))?\s*\)/g.source;

const CONTENT_TYPE_ATTRIBUTE = 'contentKey=(?:"(?<key>[^"]+)"|\\{[^\\}]+\\})\\s*';
const INTERPOLATE_ATTRIBUTE = 'interpolate=\\{(?<interpolate>\\{[^\\}]+\\})\\}\\s*';
const COMPONENT_ATTRIBUTE = 'component="(?<component>[^"]+)"\\s*';
const TRANSLATE_TAG = `<Translate\\s*(?:(?:${COMPONENT_ATTRIBUTE}|${INTERPOLATE_ATTRIBUTE}|${CONTENT_TYPE_ATTRIBUTE})+)>(?<translation>[\\s\\S]*?)<\\/Translate>`;

type Options = { keyPattern?: string; interpolatePattern?: string; wrapTranslation?: string | string[]; escapeHtml?: boolean };

const replaceTranslationKeysWithText = (
  getWebappTranslation: GetWebappTranslationCallback,
  body: string,
  regexp: string,
  { keyPattern, interpolatePattern, wrapTranslation, escapeHtml }: Options = {},
) => {
  const matches = body.matchAll(new RegExp(regexp, 'g'));
  if (typeof wrapTranslation === 'string') {
    wrapTranslation = [wrapTranslation, wrapTranslation];
  }
  for (const match of matches) {
    const target = match[0];

    let key = match.groups?.key;
    if (!key && keyPattern) {
      const keyMatch = new RegExp(keyPattern).exec(target);
      key = keyMatch?.groups?.key;
    }
    if (!key) {
      throw new Error(`Translation key not found for ${target}`);
    }

    let interpolate = match.groups?.interpolate;
    if (!interpolate && interpolatePattern) {
      const interpolateMatch = new RegExp(interpolatePattern).exec(target);
      interpolate = interpolateMatch?.groups?.interpolate;
    }

    let data: any;
    if (interpolate) {
      const interpolateMatches = interpolate.matchAll(/(?<field>[^{\s:,}]+)(?::\s*(?<value>[^,}]+))?/g);
      data = {};
      for (const interpolateMatch of interpolateMatches) {
        const field = interpolateMatch?.groups?.field;
        let value: string | number | undefined = interpolateMatch?.groups?.value;
        if (value === undefined) {
          value = key;
        }
        value = value.trim();
        if (/^\d+$/.test(value)) {
          // convert integer
          value = parseInt(value, 10);
        } else if (/^'.*'$/.test(value) || /^".*"$/.test(value)) {
          // extract string value
          value = value.substring(1, value.length - 2);
        } else {
          // wrap expression
          value = `{${value}}`;
        }
        data[field!] = value;
      }
    }

    const translation = getWebappTranslation(key, data);

    let replacement = translation;
    if (!replacement) {
      replacement = wrapTranslation ? `${wrapTranslation[0]}${wrapTranslation[1]}` : '';
    } else if (wrapTranslation) {
      replacement = `${wrapTranslation[0]}${translation}${wrapTranslation[1]}`;
    } else if (escapeHtml) {
      // Escape specific chars
      replacement = replacement.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    }
    body = body.replace(target, replacement);
  }
  return body;
};

/**
 * Replace and cleanup translations.
 */
export const createTranslationReplacer = (getWebappTranslation: GetWebappTranslationCallback) =>
  function replaceReactTranslations(body: string, filePath: string) {
    if (filePath.endsWith('.tsx')) {
      body = body.replace(new RegExp(TRANSLATE_IMPORT, 'g'), '');
      body = replaceTranslationKeysWithText(getWebappTranslation, body, `\\{\\s*${TRANSLATE_FUNCTION}\\s*\\}`, { wrapTranslation: '"' });
      body = replaceTranslationKeysWithText(getWebappTranslation, body, TRANSLATE_FUNCTION, { wrapTranslation: '"' });
      body = replaceTranslationKeysWithText(getWebappTranslation, body, TRANSLATE_TAG, {
        keyPattern: CONTENT_TYPE_ATTRIBUTE,
        interpolatePattern: INTERPOLATE_ATTRIBUTE,
        escapeHtml: true,
      });
    }
    return body;
  };

const minimatch = new Minimatch('**/*.tsx');
export const isTranslatedReactFile = (file: MemFsEditorFile) => minimatch.match(file.path);

const translateReactFilesTransform = (getWebappTranslation: GetWebappTranslationCallback) => {
  const translate = createTranslationReplacer(getWebappTranslation);
  return passthrough(file => {
    file.contents = Buffer.from(translate(file.contents.toString(), file.path));
  });
};

export default translateReactFilesTransform;
