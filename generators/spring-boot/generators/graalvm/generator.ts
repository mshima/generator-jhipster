/**
 * Copyright 2013-2024 the original author or authors from the JHipster project.
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
import { extname } from 'path';
import { isFileStateDeleted, isFileStateModified } from 'mem-fs-editor/state';
import { passthrough } from '@yeoman/transform';
import BaseApplicationGenerator from '../../../base-application/index.js';
import { createNeedleCallback } from '../../../base/support/needles.js';
import { addJavaAnnotation, addJavaImport } from '../../../java/support/add-java-annotation.js';
import { javaMainPackageTemplatesBlock } from '../../../java/support/files.js';
import { mavenDefinition } from './internal/maven-definition.js';

export default class GraalvmGenerator extends BaseApplicationGenerator {
  async beforeQueue() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints();
    }

    if (!this.delegateToBlueprint) {
      await this.dependsOnBootstrapApplication();
    }
  }

  get initializing() {
    return this.asInitializingTaskGroup({
      forceConfig() {
        // Cache is not supported for GraalVM native image
        this.jhipsterConfig.cacheProvider ??= 'no';
      },
    });
  }

  get [BaseApplicationGenerator.INITIALIZING]() {
    return this.delegateTasksToBlueprint(() => this.initializing);
  }

  get preparing() {
    return this.asPreparingTaskGroup({
      load({ application }) {
        this.loadJavaDependenciesFromGradleCatalog(application.javaDependencies!);
      },
      addNativeHint({ source, application }) {
        source.addNativeHint = ({ publicConstructors = [], declaredConstructors = [], advanced = [] }) => {
          this.editFile(
            `${application.javaPackageSrcDir}config/NativeConfiguration.java`,
            addJavaImport('org.springframework.aot.hint.MemberCategory'),
            createNeedleCallback({
              contentToAdd: [
                ...advanced,
                ...publicConstructors.map(
                  classPath =>
                    `hints.reflection().registerType(${classPath}, (hint) -> hint.withMembers(MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS));`,
                ),
                ...declaredConstructors.map(
                  classPath =>
                    `hints.reflection().registerType(${classPath}, (hint) -> hint.withMembers(MemberCategory.INVOKE_DECLARED_CONSTRUCTORS));`,
                ),
              ],
              needle: 'add-native-hints',
              ignoreWhitespaces: true,
            }),
          );
        };
      },
    });
  }

  get [BaseApplicationGenerator.PREPARING]() {
    return this.delegateTasksToBlueprint(() => this.preparing);
  }

  get default() {
    return this.asDefaultTaskGroup({
      // workaround for https://github.com/spring-projects/spring-boot/issues/32195
      async disabledInAotModeAnnotation({ application }) {
        this.queueTransformStream(
          {
            name: 'adding @DisabledInAotMode annotations',
            filter: file =>
              !isFileStateDeleted(file) &&
              isFileStateModified(file) &&
              file.path.startsWith(this.destinationPath(application.srcTestJava!)) &&
              extname(file.path) === '.java',
            refresh: false,
          },
          passthrough(file => {
            const contents = file.contents.toString('utf8');
            if (/@(MockBean|SpyBean)/.test(contents) || (application.reactive && /@AuthenticationIntegrationTest/.test(contents))) {
              file.contents = Buffer.from(
                addJavaAnnotation(contents, { package: 'org.springframework.test.context.aot', annotation: 'DisabledInAotMode' }),
              );
            }
          }),
        );
      },
    });
  }

  get [BaseApplicationGenerator.DEFAULT]() {
    return this.delegateTasksToBlueprint(() => this.default);
  }

  get writing() {
    return this.asWritingTaskGroup({
      async writingTemplateTask({ application }) {
        await this.writeFiles({
          sections: {
            common: [{ templates: ['README.md.jhi.native'] }],
            config: [
              javaMainPackageTemplatesBlock({
                templates: ['config/NativeConfiguration.java'],
              }),
            ],
            gradle: [
              {
                condition: ctx => ctx.buildToolGradle,
                templates: ['gradle/native.gradle'],
              },
            ],
          },
          context: application,
        });
      },
    });
  }

  get [BaseApplicationGenerator.WRITING]() {
    return this.delegateTasksToBlueprint(() => this.writing);
  }

  get postWriting() {
    return this.asPostWritingTaskGroup({
      hintsConfiguration({ application }) {
        const { mainClass, javaPackageSrcDir, packageName, backendTypeSpringBoot } = application;

        if (backendTypeSpringBoot) {
          this.editFile(`${javaPackageSrcDir}${mainClass}.java`, { assertModified: true }, contents =>
            addJavaAnnotation(contents, {
              package: 'org.springframework.context.annotation',
              annotation: 'ImportRuntimeHints',
              parameters: () => `{ ${packageName}.config.NativeConfiguration.JHipsterNativeRuntimeHints.class }`,
            }),
          );
        }
      },

      async packageJson({ application }) {
        const { buildToolMaven, buildToolGradle } = application;
        this.packageJson.merge({
          scripts: {
            'native-e2e': 'concurrently -k -s first -n application,e2e -c red,blue npm:native-start npm:e2e:headless',
          },
        });
        if (buildToolMaven) {
          this.packageJson.merge({
            scripts: {
              //'native-test': './mvnw -B -Pnative,dev -Dagent test',
              'native-package': './mvnw package -B -ntp -Pnative,prod -DskipTests',
              'native-package-dev': './mvnw package -B -ntp -Pnative,dev,webapp -DskipTests',
              'native-start': './target/native-executable',
            },
          });
        } else if (buildToolGradle) {
          this.packageJson.merge({
            scripts: {
              'native-package': './gradlew nativeCompile -Pnative -Pprod -x test -x integrationTest',
              'native-package-dev': './gradlew nativeCompile -Pnative -Pdev -x test -x integrationTest',
              'native-start': './build/native/nativeCompile/native-executable',
            },
          });
        }
      },

      async customizeGradle({ application, source }) {
        const { buildToolGradle, javaDependencies } = application;
        if (!buildToolGradle) return;

        source.addGradleDependencyCatalogPlugin!({
          addToBuild: true,
          pluginName: 'graalvm',
          id: 'org.graalvm.buildtools.native',
          version: javaDependencies!.nativeBuildTools!,
        });

        source.applyFromGradle!({ script: 'gradle/native.gradle' });
      },

      async customizeMaven({ application, source }) {
        const { buildToolMaven, reactive, databaseTypeSql, javaDependencies } = application;
        if (!buildToolMaven) return;

        source.addMavenDefinition!(
          mavenDefinition({ reactive, nativeBuildToolsVersion: javaDependencies!.nativeBuildTools!, databaseTypeSql }),
        );
      },

      restErrors({ application }) {
        const { javaPackageSrcDir, backendTypeSpringBoot } = application;
        if (backendTypeSpringBoot) {
          this.editFile(`${javaPackageSrcDir}/web/rest/errors/FieldErrorVM.java`, { assertModified: true }, contents =>
            addJavaAnnotation(contents, {
              package: 'org.springframework.aot.hint.annotation',
              annotation: 'RegisterReflectionForBinding',
              parameters: () => '{ FieldErrorVM.class }',
            }),
          );
        }
      },

      // workaround for arch error in backend:unit:test caused by gradle's org.graalvm.buildtools.native plugin
      technicalStructureTest({ application }) {
        const { buildToolGradle, javaPackageTestDir, backendTypeSpringBoot } = application;
        if (!buildToolGradle || !backendTypeSpringBoot) return;
        this.editFile(
          `${javaPackageTestDir}/TechnicalStructureTest.java`,
          { assertModified: true },
          addJavaImport('com.tngtech.archunit.core.domain.JavaClass.Predicates.simpleNameEndingWith', { staticImport: true }),
          contents =>
            contents.includes('__BeanFactoryRegistrations')
              ? contents
              : contents.replace(
                  '.ignoreDependency(belongToAnyOf',
                  `.ignoreDependency(simpleNameEndingWith("_BeanFactoryRegistrations"), alwaysTrue())
        .ignoreDependency(belongToAnyOf`,
                ),
        );
      },

      e2e({ application }) {
        if (!application.devDatabaseTypeH2Any || !application.cypressTests || !application.backendTypeSpringBoot) return;
        this.editFile(`${application.cypressDir}e2e/administration/administration.cy.ts`, { assertModified: true }, contents =>
          contents.replace("describe('/docs'", `describe.skip('/docs'`),
        );
        this.editFile(`${application.cypressDir}e2e/account/login-page.cy.ts`, { assertModified: true }, contents =>
          contents
            .replace("it('requires username'", `it.skip('requires username'`)
            .replace("it('requires password'", `it.skip('requires password'`),
        );
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return this.delegateTasksToBlueprint(() => this.postWriting);
  }
}