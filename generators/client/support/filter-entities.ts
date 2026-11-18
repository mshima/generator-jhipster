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
import { isEntityUpdatable, prepareEntityFieldsDerivedProperties } from '../../base-application/support/prepare-entity.ts';
import type { RelationshipWithEntity } from '../../base-application/types.ts';
import type { Entity as ClientEntity, Field as ClientField, Relationship as ClientRelationship } from '../types.ts';

export const isClientField = (field: ClientField) => !field.skipClient;

export const isClientRelationship = (rel: RelationshipWithEntity<ClientRelationship, ClientEntity>) =>
  rel.skipClient ?? !(rel.persistableRelationship || rel.relationshipEagerLoad || rel.otherEntity.jpaMetamodelFiltering);

/**
 * The entity the clients see: a copy without the fields the clients skip, the relationships being kept as they are.
 * The properties the fields give follow the fields that are left, as the templates import and declare what they tell.
 */
export const filterEntityPropertiesForClient = <const E extends ClientEntity>(entity: E): E => {
  const fields = entity.fields.filter(field => isClientField(field));
  const clientEntity: E = { ...entity, fields };
  if (fields.length !== entity.fields.length) {
    prepareEntityFieldsDerivedProperties(clientEntity);
    (clientEntity as { updatableEntity?: boolean }).updatableEntity = isEntityUpdatable(clientEntity);
  }
  return clientEntity;
};

/**
 * Filter entities for frontend templates.
 */
export const filterEntitiesForClient = <const E extends ClientEntity>(entities: E[]): E[] => entities.filter(entity => !entity.skipClient);

/**
 * Filter entities and properties for frontend templates.
 */
export const filterEntitiesAndPropertiesForClient = <const E extends ClientEntity>(entities: E[]): E[] =>
  filterEntitiesForClient(entities).map(filterEntityPropertiesForClient);
