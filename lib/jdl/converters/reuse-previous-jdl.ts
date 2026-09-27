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

import { type JDLApplicationStatement, type JDLStatement, getStatements, setStatements } from '../core/parsing/statements.ts';
import type { JDLRuntime } from '../core/parsing/types/runtime.ts';
import { markChanged, printNode } from '../core/printing/print-jdl.ts';

/** What a statement of a kind is, to find it again among other statements: its name, or what it declares. */
function statementKey(statement: JDLStatement): string {
  switch (statement.type) {
    case 'constant':
      return `constant ${statement.name}`;
    case 'application':
      return `application ${statement.application.config.baseName}`;
    case 'deployment':
      return `deployment ${statement.deployment.deploymentType}`;
    case 'entity':
      return `entity ${statement.entity.name}`;
    case 'enum':
      return `enum ${statement.enum.name}`;
    case 'relationships':
      return `relationships ${statement.cardinality}`;
    case 'option':
      return `option ${statement.option.optionName} ${statement.option.optionValue ?? ''}`;
    case 'use':
      return `use ${statement.use.optionValues.join(',')}`;
    case 'comment':
      return `comment ${statement.comment}`;
  }
}

/** For each node, the previous node printing the same, or the node itself: equal nodes take the text they were written with. */
function reuseNodes<T extends object>(nodes: readonly T[], previous: readonly T[], print: (node: T) => string): T[] {
  const available = [...previous];
  return nodes.map(node => {
    const printed = print(node);
    const index = available.findIndex(candidate => print(candidate) === printed);
    return index === -1 ? node : available.splice(index, 1)[0];
  });
}

/**
 * Keeps, among the statements converted from json, the statements of the previous jdl, so that printJDL copies them
 * from the text they were parsed from, comments and blanks included. A statement equal to a previous one of the same key is
 * the previous one. A changed one is the previous one, updated and marked changed: it keeps the equal nodes it holds
 * (the fields of an entity, the values of an enum, the relationships of a block, the statements of an application),
 * and the text around it. Two nodes are equal when they print the same. The previous statements are updated in place.
 * @param statements - the statements converted from json, without locations.
 * @param previous - the statements parsed from the previous jdl.
 */
export function reusePreviousStatements(
  statements: readonly JDLStatement[],
  previous: JDLStatement[],
  runtime: JDLRuntime,
): JDLStatement[] {
  const print = (statement: JDLStatement) => printNode.statement(statement, runtime);
  const available = [...previous];
  return statements.map(statement => {
    const key = statementKey(statement);
    const printed = print(statement);
    const sameIndex = available.findIndex(candidate => statementKey(candidate) === key && print(candidate) === printed);
    if (sameIndex !== -1) return available.splice(sameIndex, 1)[0];
    const changedIndex = available.findIndex(candidate => statementKey(candidate) === key);
    if (changedIndex === -1) return statement;
    return update(available.splice(changedIndex, 1)[0], statement, runtime);
  });
}

/** A previous statement updated to a changed one: the nodes it holds that are equal are kept, the changed ones marked. */
function update(old: JDLStatement, statement: JDLStatement, runtime: JDLRuntime): JDLStatement {
  if (old.type === 'entity' && statement.type === 'entity') {
    old.entity.body = reuseNodes(statement.entity.body ?? [], old.entity.body ?? [], printNode.field);
    if (printNode.entityHeader(old.entity) !== printNode.entityHeader(statement.entity)) {
      const { documentation, annotations, name, tableName } = statement.entity;
      markChanged(Object.assign(old.entity, { documentation, annotations, name, tableName }));
    }
    return old;
  }
  if (old.type === 'enum' && statement.type === 'enum') {
    old.enum.values = reuseNodes(statement.enum.values, old.enum.values, printNode.enumValue);
    // The header of an enum is printed.
    Object.assign(old.enum, { documentation: statement.enum.documentation, name: statement.enum.name });
    return old;
  }
  if (old.type === 'relationships' && statement.type === 'relationships') {
    old.relationships = reuseNodes(statement.relationships, old.relationships, printNode.relationship);
    return old;
  }
  if (old.type === 'application' && statement.type === 'application') {
    setStatements(
      old.application,
      reuseNodes(
        getStatements<JDLApplicationStatement>(statement.application) ?? [],
        getStatements<JDLApplicationStatement>(old.application) ?? [],
        applicationStatement => printNode.applicationStatement(applicationStatement, runtime),
      ),
    );
    return old;
  }
  return markChanged(Object.assign(old, statement));
}
