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

/** Escapes a value for a Java string literal. */
const escapeJavaString = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * The two values of a String field in the tests of its REST resource, as Java string literals: the default one and the
 * updated one, different, with the length the min and max length allow, matching the pattern of the field when it has one.
 */
export const generateTestStringValues = ({
  entityClass,
  field,
  log,
}: {
  entityClass: string;
  field: {
    fieldName: string;
    fieldValidateRulesMinlength?: number;
    fieldValidateRulesMaxlength?: number;
    fieldValidateRulesPattern?: string;
    generateFakeDataFromPattern?: () => string | undefined;
  };
  log: { warn: (message: string) => void };
}): { defaultValue: string; updatedValue: string } => {
  let length = 10;
  if (field.fieldValidateRulesMinlength! > length) {
    length = field.fieldValidateRulesMinlength!;
  }
  if (field.fieldValidateRulesMaxlength! < length) {
    length = field.fieldValidateRulesMaxlength!;
  }
  let defaultValue = 'A'.repeat(length);
  let updatedValue = 'B'.repeat(length);
  const pattern = field.fieldValidateRulesPattern;
  if (pattern === undefined) {
    return { defaultValue, updatedValue };
  }
  try {
    const patternRegExp = new RegExp(pattern);
    if (!patternRegExp.test(defaultValue)) {
      defaultValue = escapeJavaString(field.generateFakeDataFromPattern!()!);
    }
    if (!patternRegExp.test(updatedValue)) {
      updatedValue = escapeJavaString(field.generateFakeDataFromPattern!()!);
    }
  } catch (error) {
    log.warn(
      `Error generating test value for entity "${entityClass}" field "${field.fieldName}" with pattern "${pattern}", generating default values for this field. Detailed error message: "${(error as Error).message}".`,
    );
  }
  // A pattern accepting few values may generate the same value twice: generate another one, appending a symbol would break the pattern.
  for (let attempt = 0; defaultValue === updatedValue && attempt < 10; attempt++) {
    const value = field.generateFakeDataFromPattern!();
    if (!value) break;
    updatedValue = escapeJavaString(value);
  }
  if (defaultValue === updatedValue) {
    updatedValue = `${updatedValue}B`;
    log.warn(
      `Randomly generated first and second test values for entity "${entityClass}" field "${field.fieldName}" with pattern "${pattern}" in file "${entityClass}ResourceIT" where equal, added symbol "B" to second value.`,
    );
  }
  return { defaultValue, updatedValue };
};
