/* eslint-disable no-template-curly-in-string */
import type { MavenDefinition } from '../../../../maven/types.js';

export const mavenDefinition = ({
  reactive,
  nativeBuildToolsVersion,
  databaseTypeSql,
  userLanguage,
  languages,
}: {
  reactive?: boolean;
  nativeBuildToolsVersion?: string;
  databaseTypeSql?: boolean;
  userLanguage: string;
  languages: string[];
}): MavenDefinition => ({
  properties: [
    { property: 'repackage.classifier' },
    { property: 'native-image-name', value: 'native-executable' },
    { property: 'native-buildtools.version', value: nativeBuildToolsVersion },
  ],
  pluginManagement: [
    {
      groupId: 'org.graalvm.buildtools',
      artifactId: 'native-maven-plugin',
      version: '${native-buildtools.version}',
      additionalContent: `
        <configuration>
            <fallback>false</fallback>
            <classesDirectory>\${project.build.outputDirectory}</classesDirectory>
            <metadataRepository>
                <enabled>true</enabled>
            </metadataRepository>
            <imageName>\${native-image-name}</imageName>
            <verbose>true</verbose>
            <buildArgs>
                <buildArg>-Duser.language=${userLanguage}</buildArg>
                <buildArg>-H:IncludeLocales=${languages.join(',')}</buildArg>
                <buildArg>--initialize-at-run-time=com.tngtech.archunit.junit.internal.ArchUnitTestDescriptor,com.tngtech.archunit,ch.qos.logback,org.springframework.boot.logging.logback</buildArg>
                <buildArg>--trace-class-initialization=com.tngtech.archunit.base.DescribedPredicate$DescribePredicate,com.tngtech.archunit.base.DescribedPredicate$2,com.tngtech.archunit.base.DescribedPredicate$3,ch.qos.logback.core.model.processor.DefaultProcessor$1,com.tngtech.archunit.core.domain.PackageMatcher,ch.qos.logback.core.util.StatusPrinter2,com.tngtech.archunit.base.DescribedPredicate$4,com.tngtech.archunit.thirdparty.com.google.common.math.IntMath$1,ch.qos.logback.core.status.WarnStatus,org.slf4j.LoggerFactory,com.tngtech.archunit.core.domain.JavaClass$Predicates$8,com.tngtech.archunit.junit.internal.ArchUnitSystemPropertyTestFilterJUnit5,org.springframework.boot.logging.logback.ColorConverter,com.tngtech.archunit.core.domain.JavaClass$Predicates$1,ch.qos.logback.classic.PatternLayout,com.tngtech.archunit.thirdparty.com.google.common.cache.LocalCache,ch.qos.logback.core.rolling.helper.FileNamePattern,com.tngtech.archunit.base.DescribedPredicate$OrPredicate,ch.qos.logback.core.rolling.helper.Compressor$1,org.slf4j.helpers.Reporter,ch.qos.logback.core.subst.Token,com.tngtech.archunit.base.DescribedPredicate,ch.qos.logback.core.model.processor.ImplicitModelHandler$1,ch.qos.logback.core.status.InfoStatus,ch.qos.logback.core.subst.Parser$1,ch.qos.logback.core.util.Duration,com.tngtech.archunit.base.DescribedPredicate$AsPredicate,com.tngtech.archunit.core.domain.JavaClass$Predicates$3,ch.qos.logback.core.CoreConstants,ch.qos.logback.classic.model.processor.LogbackClassicDefaultNestedComponentRules,ch.qos.logback.core.joran.JoranConstants,ch.qos.logback.classic.Logger,ch.qos.logback.core.status.StatusBase,ch.qos.logback.classic.Level,com.mycompany.myapp.TechnicalStructureTest,ch.qos.logback.core.util.StatusPrinter,ch.qos.logback.core.rolling.helper.RollingCalendar$1,com.tngtech.archunit.base.DescribedPredicate$OnResultOfPredicate,com.tngtech.archunit.core.domain.JavaClass$Predicates$10,com.tngtech.archunit.ArchConfiguration,org.junit.platform.engine.support.hierarchical.Node$SkipResult,com.tngtech.archunit.core.domain.JavaClass$Predicates$BelongToPredicate,com.tngtech.archunit.junit.internal.ArchUnitTestDescriptor,com.tngtech.archunit.core.domain.JavaClass$Predicates$2,ch.qos.logback.core.model.processor.ChainedModelFilter$1,ch.qos.logback.core.joran.util.AggregationAssessor$1,ch.qos.logback.core.rolling.helper.RollingCalendar,com.tngtech.archunit.core.domain.JavaClass$Predicates$5,com.tngtech.archunit.core.domain.JavaClass$Predicates,com.tngtech.archunit.base.DescribedPredicate$AndPredicate,ch.qos.logback.core.subst.NodeToStringTransformer$1,com.tngtech.archunit.base.DescribedPredicate$1,com.tngtech.archunit.thirdparty.com.google.common.base.Platform,ch.qos.logback.core.util.FileSize,com.tngtech.archunit.core.domain.JavaClass$Predicates$7,com.tngtech.archunit.core.domain.JavaClass$Predicates$PackageMatchesPredicate,com.tngtech.archunit.core.domain.JavaClass$Predicates$9,ch.qos.logback.core.pattern.parser.Parser,com.tngtech.archunit.core.domain.JavaClass$Predicates$6,ch.qos.logback.core.util.Loader,com.tngtech.archunit.core.domain.JavaClass$Predicates$4,com.tngtech.archunit.junit.internal.ArchUnitTestEngine$SharedCache</buildArg>
                <buildArg>-DtestDiscovery</buildArg>
            </buildArgs>
            <jvmArgs>
                <arg>-Xms4g</arg>
                <arg>-Xmx10g</arg>
            </jvmArgs>
        </configuration>`,
    },
    ...(reactive || !databaseTypeSql
      ? []
      : [
          {
            groupId: 'org.hibernate.orm.tooling',
            artifactId: 'hibernate-enhance-maven-plugin',
            version: '${hibernate.version}',
            additionalContent: `
                <configuration>
                    <enableLazyInitialization>true</enableLazyInitialization>
                </configuration>`,
          },
        ]),
  ],
  profiles: [
    {
      id: 'native',
      content: `
        <properties>
            <repackage.classifier>exec</repackage.classifier>
            <modernizer.skip>true</modernizer.skip>
            <spring.h2.console.enabled>false</spring.h2.console.enabled>
        </properties>
        <build>
            <plugins>${
              databaseTypeSql && !reactive
                ? `
                <plugin>
                    <groupId>org.hibernate.orm.tooling</groupId>
                    <artifactId>hibernate-enhance-maven-plugin</artifactId>
                    <executions>
                        <execution>
                            <goals>
                                <goal>enhance</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>`
                : ``
            }
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-jar-plugin</artifactId>
                    <configuration>
                        <archive>
                            <manifestEntries>
                                <Spring-Boot-Native-Processed>true</Spring-Boot-Native-Processed>
                            </manifestEntries>
                        </archive>
                    </configuration>
                </plugin>
                <plugin>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-maven-plugin</artifactId>
                    <configuration>
                        <image>
                            <builder>paketobuildpacks/builder:tiny</builder>
                            <env>
                                <BP_NATIVE_IMAGE>true</BP_NATIVE_IMAGE>
                            </env>
                        </image>
                    </configuration>
                    <executions>
                        <execution>
                            <id>process-aot</id>
                            <goals>
                                <goal>process-aot</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>
                <plugin>
                    <groupId>org.graalvm.buildtools</groupId>
                    <artifactId>native-maven-plugin</artifactId>
                    <executions>
                        <execution>
                            <id>add-reachability-metadata</id>
                            <goals>
                                <goal>add-reachability-metadata</goal>
                            </goals>
                        </execution>
                        <execution>
                            <id>build-native</id>
                            <goals>
                                <goal>compile-no-fork</goal>
                            </goals>
                            <phase>package</phase>
                        </execution>
                        <execution>
                            <id>test-native</id>
                            <goals>
                                <goal>test</goal>
                            </goals>
                            <phase>test</phase>
                        </execution>
                    </executions>
                </plugin>
            </plugins>
        </build>`,
    },
  ],
});
