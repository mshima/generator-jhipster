import { describe, expect, it } from 'esmocha';

import { getApplicationConfigWithDefaults } from './config-defaults.ts';

/**
 * The application defaults table the commands replaced (lib/jhipster/default-application-options.ts before v9.5),
 * kept as the reference of the behavior. It also forces values from other options, which are not defaults.
 */
const legacyGetConfigWithDefaults = (custom: Record<string, any> = {}): Record<string, any> => {
  let o: Record<string, any> = { ...custom };
  if (o.graalvmSupport) o.cacheProvider = 'no';
  const common = {
    authenticationType: 'jwt',
    buildTool: 'maven',
    dtoSuffix: 'DTO',
    enableSwaggerCodegen: false,
    enableTranslation: true,
    entitySuffix: '',
    jhiPrefix: 'jhi',
    messageBroker: 'no',
    searchEngine: 'no',
    websocket: 'no',
  };
  if (o.applicationType === 'gateway') {
    o = { ...common, clientFramework: 'angular', serverPort: 8080, serviceDiscoveryType: 'consul', withAdminUi: true, ...o };
    o.cacheProvider ??= 'no';
    o.enableHibernateCache = false;
    o = { reactive: true, ...o, applicationType: 'gateway' };
  } else if (o.applicationType === 'microservice') {
    o = { ...common, serverPort: 8081, serviceDiscoveryType: 'consul', skipUserManagement: true, clientFramework: 'no', ...o };
    o.cacheProvider ??= o.reactive ? 'no' : 'hazelcast';
    o.withAdminUi = false;
    o = { ...o, applicationType: 'microservice' };
  } else {
    o = { ...common, clientFramework: 'angular', serverPort: 8080, serviceDiscoveryType: 'no', withAdminUi: true, ...o };
    o.cacheProvider ??= o.reactive ? 'no' : 'ehcache';
    o = { ...o, applicationType: 'monolith' };
  }
  if (o.skipClient) o.clientFramework = 'no';
  if (o.clientFramework !== 'no') {
    if (!o.clientTheme) o.clientTheme = 'none';
    else if (o.clientTheme !== 'none' && !o.clientThemeVariant) o.clientThemeVariant = 'primary';
  }
  if (!o.packageName) o.packageName = o.packageFolder ? o.packageFolder.split('/').filter(Boolean).join('.') : 'com.mycompany.myapp';
  o.databaseType ??= 'sql';
  if (o.databaseType === 'sql') {
    o.prodDatabaseType ??= 'postgresql';
    o.devDatabaseType ??= o.prodDatabaseType;
  }
  if (o.databaseType === 'no') o.skipUserManagement = true;
  o.databaseMigration ??= o.databaseType === 'sql' || o.databaseType === 'cassandra' ? 'liquibase' : 'no';
  o.cacheProvider ??= 'no';
  o.enableHibernateCache ??= o.databaseType === 'sql' && !o.reactive && !['no', 'memcached'].includes(o.cacheProvider);
  o.reactive ??= false;
  o.enableTranslation ??= true;
  o.nativeLanguage ??= 'en';
  if (o.enableTranslation && o.languages === undefined) o.languages = [];
  if (typeof o.skipUserManagement !== 'boolean') o.skipUserManagement = o.authenticationType === 'oauth2';
  return o;
};

/** Every combination of the values, undefined meaning the option is not set. */
const combinations = (options: Record<string, any[]>): Record<string, any>[] =>
  Object.entries(options).reduce<Record<string, any>[]>(
    (acc, [name, values]) =>
      acc.flatMap(combination => values.map(value => (value === undefined ? combination : { ...combination, [name]: value }))),
    [{}],
  );

describe('command config defaults', () => {
  describe('getApplicationConfigWithDefaults', () => {
    const matrix = combinations({
      applicationType: [undefined, 'monolith', 'gateway', 'microservice'],
      reactive: [undefined, true, false],
      databaseType: [undefined, 'sql', 'mongodb', 'cassandra', 'no'],
      cacheProvider: [undefined, 'ehcache', 'memcached', 'no'],
      skipClient: [undefined, true],
      clientFramework: [undefined, 'no', 'react'],
      clientTheme: [undefined, 'none', 'darkly'],
      authenticationType: [undefined, 'oauth2'],
      enableTranslation: [undefined, false],
      packageFolder: [undefined, 'com/foo/bar'],
      graalvmSupport: [undefined, true],
    });

    it('should fill an empty configuration with the monolith defaults', () => {
      expect(getApplicationConfigWithDefaults({})).toMatchInlineSnapshot(`
{
  "applicationType": "monolith",
  "authenticationType": "jwt",
  "buildTool": "maven",
  "cacheProvider": "ehcache",
  "clientFramework": "angular",
  "clientTestFramework": "vitest",
  "clientTheme": "none",
  "databaseMigration": "liquibase",
  "databaseType": "sql",
  "defaultEnvironment": "prod",
  "defaultPackaging": "jar",
  "devDatabaseType": "postgresql",
  "dtoSuffix": "DTO",
  "enableGradleDevelocity": false,
  "enableHibernateCache": true,
  "enableSwaggerCodegen": false,
  "enableTranslation": true,
  "entitySuffix": "",
  "feignClient": false,
  "jhiPrefix": "jhi",
  "languages": [],
  "messageBroker": "no",
  "nativeLanguage": "en",
  "packageName": "com.mycompany.myapp",
  "prettierTabWidth": 2,
  "prodDatabaseType": "postgresql",
  "reactive": false,
  "searchEngine": "no",
  "serverPort": 8080,
  "serviceDiscoveryType": "no",
  "skipUserManagement": false,
  "websocket": "no",
  "withAdminUi": true,
}
`);
    });

    it(`should match the legacy application defaults table for ${matrix.length} configurations`, () => {
      const differences: { config: Record<string, any>; legacy: Record<string, any>; commands: Record<string, any> }[] = [];
      for (const config of matrix) {
        // The forced values are applied by getConfigWithDefaults before the defaults.
        const forced = { ...config };
        if (forced.graalvmSupport) forced.cacheProvider = 'no';
        if (forced.skipClient) forced.clientFramework = 'no';
        if (forced.applicationType === 'gateway') forced.enableHibernateCache = false;
        if (forced.applicationType === 'microservice') forced.withAdminUi = false;
        if (forced.databaseType === 'no') forced.skipUserManagement = true;

        const legacy = legacyGetConfigWithDefaults(config);
        const actual = getApplicationConfigWithDefaults(forced);
        // Commands declare defaults the table never had (clientTestFramework, feignClient, ...): compare the table's keys.
        const commands = Object.fromEntries(Object.keys(legacy).map(key => [key, actual[key]]));
        if (JSON.stringify(commands) !== JSON.stringify(legacy)) {
          differences.push({ config, legacy, commands });
        }
      }
      // The first ones are enough to see what differs.
      expect({ differences: differences.length, first: differences.slice(0, 3) }).toEqual({ differences: 0, first: [] });
    });
  });
});
