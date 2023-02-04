import type { GenericDerivedProperty, OptionalGenericDerivedProperty } from '../base/application.mjs';
import { I18nApplication } from '../languages/types.mjs';
import { Entity } from './tasks.mjs';

export type BaseApplication = {
  jhipsterVersion: string;
  baseName: string;
  capitalizedBaseName: string;
  dasherizedBaseName: string;
  humanizedBaseName: string;
  camelizedBaseName: string;
  hipster: string;
  lowercaseBaseName: string;
  upperFirstCamelCaseBaseName: string;

  projectVersion: string;
  projectDescription: string;

  jhiPrefix: string;
  entitySuffix: string;
  dtoSuffix: string;

  skipCommitHook: boolean;
  skipJhipsterDependencies: boolean;
  fakerSeed?: string;

  nodeVersion: string;
  nodePackageManager: string;
  nodeDependencies: Record<string, string>;

  skipClient?: boolean;
  skipServer?: boolean;
} & I18nApplication;

/* ApplicationType Start */
type ApplicationType = {
  applicationType: 'monolith' | 'microservice' | 'gateway';
};

type MicroservicesArchitectureApplication = {
  microfrontend: boolean;
  gatewayServerPort: number;
};

type MicroserviceApplication = GenericDerivedProperty<ApplicationType, 'microservice'> & MicroservicesArchitectureApplication;

type GatewayApplication = GenericDerivedProperty<ApplicationType, 'gateway'> &
  MicroservicesArchitectureApplication & {
    microfrontends: string[];
  };

type MonolithApplication = GenericDerivedProperty<ApplicationType, 'monolith'>;
/* ApplicationType End */

/* AuthenticationType Start */
type UserManagement =
  | {
      skipUserManagement: true;
    }
  | {
      skipUserManagement: false;
      user: any;
    };

type AuthenticationType = {
  authenticationType: 'jwt' | 'oauth2' | 'session';
};

type JwtApplication = UserManagement &
  GenericDerivedProperty<AuthenticationType, 'jwt'> & {
    jwtSecretKey: string;
  };

type Oauth2Application = GenericDerivedProperty<AuthenticationType, 'oauth2'> & {
  jwtSecretKey: string;
  skipUserManagement: false;
  user: any;
};

type SessionApplication = UserManagement &
  GenericDerivedProperty<AuthenticationType, 'session'> & {
    rememberMeKey: string;
  };
/* AuthenticationType End */

type QuirksApplication = {
  cypressBootstrapEntities?: boolean;
};

export type CommonClientServerApplication = BaseApplication &
  QuirksApplication &
  (JwtApplication | Oauth2Application | SessionApplication) &
  (MonolithApplication | GatewayApplication | MicroserviceApplication) & {
    clientSrcDir: string;
    clientTestDir?: string;
    clientDistDir?: string;
    devServerPort: number;
    pages: string[];

    serverPort: number;
    backendType?: string;
    temporaryDir?: string;

    dockerServicesDir?: string;
    prettierExtensions?: string;

    generateUserManagement?: boolean;
    generateBuiltInUserEntity?: boolean;
    generateBuiltInAuthorityEntity?: boolean;
  };

type ServiceDiscoveryType = 'no' | 'eureka' | 'consul';

declare const SERVICE_DISCOVERY_TYPE = 'serviceDiscoveryType';

type ServiceDiscovery = {
  [SERVICE_DISCOVERY_TYPE]: ServiceDiscoveryType;
};

type ServiceDiscoveryApplication = OptionalGenericDerivedProperty<ServiceDiscovery, ServiceDiscovery[typeof SERVICE_DISCOVERY_TYPE]>;

type MonitoringType = 'no' | 'elk' | 'prometheus';

declare const MONITORING_TYPE = 'monitoring';

type Monitoring = {
  [MONITORING_TYPE]: MonitoringType;
};

type MonitoringApplication = OptionalGenericDerivedProperty<Monitoring, Monitoring[typeof MONITORING_TYPE]>;

export type PlatformApplication = ServiceDiscoveryApplication & MonitoringApplication;

export type Field = {
  fieldName: string;
  fieldType: string;
  fieldTypeBlobContent: string;
} & Record<string, any>;

export type Relationship = {
  relationshipName: string;
} & Record<string, any>;

export type BaseEntity = {
  name: string;
  changelogDate?: string;
  dto?: string;

  primaryKey?: Record<string, any>;
  fields?: Field[];
  relationships?: Relationship[];

  readOnly?: boolean;
  embedded?: boolean;
  skipClient?: boolean;
};

export type Entity = Required<BaseEntity> & {
  builtIn?: boolean;
  microserviceName?: string;

  entityNameCapitalized: string;
  entityClass: string;
  entityInstance: string;
  entityTableName: string;
  entityNamePlural: string;

  dtoClass?: string;
  dtoInstance?: string;

  persistClass: string;
  persistInstance: string;
  restClass: string;
  restInstance: string;

  entityNamePluralizedAndSpinalCased: string;
  entityClassPlural: string;
  entityInstancePlural: string;

  entityI18nVariant: string;
  entityClassHumanized: string;
  entityClassPluralHumanized: string;

  entityFileName: string;
  entityFolderName: string;
  entityModelFileName: string;
  entityParentPathAddition: string;
  entityPluralFileName: string;
  entityServiceFileName: string;

  entityAngularName: string;
  entityAngularNamePlural: string;
  entityReactName: string;

  entityApiUrl: string;
  entityStateName: string;
  entityUrl: string;

  entityTranslationKey: string;
  entityTranslationKeyMenu: string;

  i18nKeyPrefix: string;
  i18nAlertHeaderPrefix: string;

  entityApi: string;
  entityPage: string;
};
