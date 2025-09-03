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
import { describe, expect, it } from 'esmocha';

import { getGeneratorsNamespaces } from '../lib/index.ts';

describe('public api', () => {
  it('generator-jhipster/generators should match snapshot', async () => {
    // eslint-disable-next-line import-x/extensions
    expect(await import('generator-jhipster/generators')).toMatchSnapshot();
  });

  it('generator-jhipster/generators should match snapshot', async () => {
    // eslint-disable-next-line import-x/extensions
    expect(Object.keys(await import('generator-jhipster/testing'))).toMatchSnapshot();
  });

  it('should import neasted sub-generators', async () => {
    // eslint-disable-next-line import-x/extensions
    expect(await import('generator-jhipster/generators/spring-cloud-stream/generators/kafka')).toBeDefined();
  });
});

describe('getGeneratorsNamespaces', () => {
  it('should return the correct generator namespaces', () => {
    expect(getGeneratorsNamespaces()).toMatchInlineSnapshot(`
[
  "jhipster:angular",
  "jhipster:angular:bootstrap",
  "jhipster:app",
  "jhipster:app:bootstrap",
  "jhipster:base",
  "jhipster:base-application",
  "jhipster:base-application:bootstrap",
  "jhipster:base-core",
  "jhipster:base-entity-changes",
  "jhipster:base-simple-application",
  "jhipster:base-simple-application:bootstrap",
  "jhipster:base-workspaces",
  "jhipster:bootstrap",
  "jhipster:bootstrap-application",
  "jhipster:bootstrap-application-base",
  "jhipster:bootstrap-application-client",
  "jhipster:bootstrap-application-server",
  "jhipster:bootstrap-workspaces",
  "jhipster:ci-cd",
  "jhipster:client",
  "jhipster:client:bootstrap",
  "jhipster:client:common",
  "jhipster:client:i18n",
  "jhipster:common",
  "jhipster:common:bootstrap",
  "jhipster:cucumber",
  "jhipster:cypress",
  "jhipster:docker",
  "jhipster:docker-compose",
  "jhipster:docker:bootstrap",
  "jhipster:entities",
  "jhipster:entity",
  "jhipster:export-jdl",
  "jhipster:feign-client",
  "jhipster:gatling",
  "jhipster:generate-blueprint",
  "jhipster:git",
  "jhipster:gradle",
  "jhipster:gradle:code-quality",
  "jhipster:gradle:jib",
  "jhipster:gradle:node-gradle",
  "jhipster:heroku",
  "jhipster:info",
  "jhipster:init",
  "jhipster:java",
  "jhipster:java:bootstrap",
  "jhipster:java:build-tool",
  "jhipster:java:code-quality",
  "jhipster:java:domain",
  "jhipster:java:graalvm",
  "jhipster:java:i18n",
  "jhipster:java:jib",
  "jhipster:java:node",
  "jhipster:java:openapi-generator",
  "jhipster:java:server",
  "jhipster:javascript-simple-application",
  "jhipster:javascript-simple-application:bootstrap",
  "jhipster:javascript-simple-application:eslint",
  "jhipster:javascript-simple-application:husky",
  "jhipster:javascript-simple-application:prettier",
  "jhipster:jdl",
  "jhipster:jdl:bootstrap",
  "jhipster:kubernetes",
  "jhipster:kubernetes-helm",
  "jhipster:kubernetes-knative",
  "jhipster:kubernetes:bootstrap",
  "jhipster:languages",
  "jhipster:languages:bootstrap",
  "jhipster:liquibase",
  "jhipster:maven",
  "jhipster:maven:code-quality",
  "jhipster:maven:frontend-plugin",
  "jhipster:maven:jib",
  "jhipster:project-name",
  "jhipster:project-name:bootstrap",
  "jhipster:react",
  "jhipster:react:bootstrap",
  "jhipster:server",
  "jhipster:server:bootstrap",
  "jhipster:spring-boot",
  "jhipster:spring-boot:bootstrap",
  "jhipster:spring-boot:jwt",
  "jhipster:spring-boot:oauth2",
  "jhipster:spring-cache",
  "jhipster:spring-cloud-stream",
  "jhipster:spring-cloud-stream:kafka",
  "jhipster:spring-cloud-stream:pulsar",
  "jhipster:spring-cloud:gateway",
  "jhipster:spring-data-cassandra",
  "jhipster:spring-data-couchbase",
  "jhipster:spring-data-elasticsearch",
  "jhipster:spring-data-mongodb",
  "jhipster:spring-data-neo4j",
  "jhipster:spring-data-relational",
  "jhipster:spring-websocket",
  "jhipster:upgrade",
  "jhipster:vue",
  "jhipster:vue:bootstrap",
  "jhipster:workspaces",
]
`);
  });
});
