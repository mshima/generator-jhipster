# Implementation knowledge base for AI agents

Deep-dive notes complementing [`AGENTS.md`](./AGENTS.md). Facts below were verified against the
source tree when written; when in doubt, re-verify — file paths are the anchors. Sections:
[conventions](#templates-and-generator-conventions), [built-in entities](#built-in-user-entities),
[Angular](#angular-client), [Vue](#vue-client), [React](#react-client), [Spring Boot](#spring-boot-server),
[user caches](#server-side-user-caches), [testing and samples](#testing-and-samples),
[debugging CI](#debugging-ci-failures).

## Templates and generator conventions

- Refactoring rule: generated code must stay byte-identical unless a real output bug is being fixed.
  Verify with a baseline: `git stash`, generate a sample into the scratchpad from a JDL, `git stash pop`,
  generate again into a sibling directory and `diff -r -q` the trees (ignore `.yo-rc.json`, jwt secrets,
  keystore, `application.yml`). Faker-sequence shifts caused by a genuinely new field are expected.
- Removed or renamed generated files are declared with `control.cleanupFiles({ '<version>': [...] })` in a
  cleanup task inside the generator's own `generator.ts`, not in the legacy `cleanup.ts` files.
- Types and derived properties added to the Angular generator carry an `angular`/`Angular` prefix
  (`AngularFieldClientConstant`, `angularFieldNameSingular`, …); genuinely generic properties belong to
  base-application/client instead.
- `ejs-templates/indent` (repo eslint, run by `check-npm-test`) checks standalone `<%_ … _%>` tags by brace depth
  only: `depth × 2` spaces from column 0, independent of the surrounding XML/Java indentation. Output lines keep
  their own indentation, so re-indenting the tags never changes the generated file.
- Translation macros (`__jhiTranslateTag__`, `__jhiTranslateTagEnum__`, `__jhiTranslatePipe__`, …) are replaced by
  `generators/angular/support/translate-angular.ts`. Pitfall: when a key has no translation,
  `getWebappTranslation(key)` falls back to a plain string, and the `TagEnum`/`PipeEnum` replacements emit
  `JSON.stringify(translation)[value]` as inline fallback — indexing a string with a string key, which fails Angular
  strict builds with `TS7015`. Only use the enum macros for keys that actually have generated translations.
- Grep every quoting/EJS form before declaring something unused: `@content` looked unused in the Vue templates
  because `global.scss.ejs` and `jhi-navbar.vue.ejs` emit `url("<%- clientBundlerRsbuild ? '@' : '/' %>content/…")`,
  while `rsbuild.config.ts` still needs the alias (Vite uses absolute `/content/…` URLs).

## Built-in user entities

- `generators/base-application/internal/utils.ts` creates the built-in entities: `User`
  (`createUserEntity`), `UserManagement` (`createUserManagementEntity`, cloned from User with
  `login` as id and `id` hidden), and `Authority`.
- Cassandra (and no-database) specifics: no `imageUrl` field, `pagination: 'no'`,
  `auditableEntity: false` — the audit fields (`createdBy`, `createdDate`, `lastModifiedBy`,
  `lastModifiedDate`, from `getAuditFields()`) are only added when `!databaseTypeCassandra`.
- `application.generateBuiltInAuthorityEntity` is `generateBuiltInUserEntity && databaseType !== 'cassandra'`
  (`generators/base-application/application.ts`). Without it, UserManagement gets **no** `Authority`
  relationship — but the server DTO still exposes `authorities` as `Set<String>`, so clients must
  keep an `authorities?: string[]` property (Angular gets it as a built-in field, see below).
- With translation enabled, `langKey` becomes a **synthetic** enum field (`fieldType: 'Languages'`,
  `fieldValues` from `application.languages`, `clientConstantsAsValues: true`, `defaultValue` = native language,
  `skipServer: true`). It exists to type the field and drive the update-form select. There are **no i18n entries**
  for a `Languages` enum — templates must not run it through the enum-translation macros (render it as plain
  text; the Angular model types it as `(typeof LANGUAGES)[number]` from `app/config/language.constants`).
- Field modifiers used by the built-in entities: `collection: true` (array-valued field),
  `clientConstantsAsValues: true` (select options come from a client constant instead of an enum), and the
  relationship modifier `relationshipSerializePrimaryKeyOnly: true` (UserManagement → Authority is serialized as
  the other entity's primary keys, typed `string[]` on the Angular side).
- React and Vue set `skipClient: true` on the built-in user entities; their user-management lives in plain
  templates (`…/app/modules/administration/user-management/` for React).

## Angular client

### User management and constants

- User-management pages are generated from the **shared entity templates**
  (`generators/angular/templates/src/main/webapp/app/entities/_entityFolder_/…`) with the entity flag
  `builtInUserManagement`; remaining hand-written pages live under `…/app/entities/admin/user-management/`. Grep
  for `builtInUserManagement` in templates to find the existing special cases (langKey typing/rendering,
  Authority relationship inclusion) before adding behavior.
- Without an Authority entity (Cassandra/no database) the Angular `UserManagement` gets a built-in
  `authorities` **field** (`fieldType: 'Authority'`, `fieldValues: 'ROLE_ADMIN,ROLE_USER'`, `collection: true`,
  `clientConstantsAsValues: true`, `skipServer: true`) appended in `createUserManagementEntity`; `langKey` is
  handled the same way through `Languages`.
- The Angular generator maps constant-backed field types to their client constants in
  `angularClientConstants` (`generators/angular/generator.ts`): `Languages` → `LANGUAGES` from `app/config`
  (label pipe `findLanguageFromKey`), `Authority` → `Authority` from `app/shared/jhipster/constants` (ts type
  `string`). `prepareField` sets `field.angularFieldClientConstant` (`angularConstantName`,
  `angularConstantImportPath`, `angularConstantTsType`, `angularConstantValues`, `angularConstantLabelPipe`) and
  `angularFieldNameSingular`; the shared templates render `<option [value]="x">{{ x | pipe }}` selects,
  multi-selects and badge lists from it.
- The form service never disables a non-auto-generated id (`login` stays editable); only `resetForm` marks the
  primary key.
- `login.service.ts.ejs` needs `AuthServerProvider` for oauth2 too (from `auth-session.service`, since
  `authenticationUsesCsrf` covers `oauth2` and `session`); dropping that import broke every oauth2/session sample
  with `TS2304`.

### Build: esbuild only, native federation

- Angular is esbuild-only since 9.3.1: `clientBundler` `webpack`/`experimentalEsbuild` is deleted from
  `.yo-rc.json` by the `migrateToEsbuild` configuring task, `angular.json.ejs` is the former esbuild variant, the
  `webpack/` templates, `source.addWebpackConfig` (Angular), `@angular-builders/custom-webpack`,
  `@module-federation/enhanced`, `browser-sync` and `@ngx-translate/http-loader` are gone, and old `webpack/*`
  files are removed through `control.cleanupFiles` `'9.3.1'`. Cypress' Angular webpack coverage path
  (`cypressCoverageWebpack`, `webapp:instrumenter`) was removed with it; `angularSchematic` is now simply
  `clientFrameworkAngular`. Server templates keep their `clientBundlerWebpack` branches for Vue only. Renaming CI
  jobs (the `-webpack` suffixes) reshuffles the build matrix node/java indexes — that is by design
  (`randomEnvironment`), refresh the `.blueprint/github-build-matrix` snapshot.
- Microfrontends use `@angular-architects/native-federation`. Pieces: `federation.config.ts` (shares npm deps via
  `shareAll`, dayjs entry points via `shareDayjs`, Angular locales via `shareAngularLocales`, app singletons via
  `sharedMappings`), `tsconfig.federation.json` (exposed entries), and `build-plugins` as a local builder package
  (`./build-plugins:native-federation`) wrapping `runBuilder` to inject the esbuild plugins — native federation
  runs Angular's application builder itself, so `@angular-builders/custom-esbuild` plugins would be bypassed.
  `es-module-shims` must be in the `polyfills` list and in `dependencies`; the gateway needs `entryPoints` set
  because it exposes nothing (NF's fallback is `src/main.ts`).
- `build-plugins/` is all TypeScript, including the local Architect builder (`native-federation.ts`, referenced
  from `builders.json`): Architect `import()`s it and Node's native type stripping (required Node ≥ 22.18) handles
  the `.ts`. The package is `"type": "module"`, so the esbuild plugins must be ESM-clean — `import.meta.dirname`
  instead of `__dirname`, `createRequire(import.meta.url)` instead of a bare `require` — otherwise the builder path
  fails with "\_\_dirname is not defined in ES module scope" while `@angular-builders/custom-esbuild`
  (non-microfrontend apps, own loader) keeps working and hides the problem.
- `federation.config.ts` is TypeScript without any loader: native federation `import()`s the config path itself
  (`federationConfigPath` builder option) and generated apps require the Node version in
  `generators/init/resources/.node-version` (≥ 22.18), which strips type annotations natively. Keep the file to
  erasable syntax only (annotations, `import type`; no enums, namespaces or parameter properties). Do not reach for
  `jiti/register`: its process-wide hooks also rewrite `.json` imports and the Angular CLI fails with
  "@babel/compat-data/data/native-modules.json … is not valid JSON".
- The `@angular/build:unit-test` builder uses the build target options only (no custom plugins):
  `vitest-base.config.ts` resolves the virtual `i18n/<lang>.json` modules, and `SERVER_API_URL` must also stay in
  the `angular.json` `define` for the tests.

### Native federation sharing rules

- Native federation only shares **barrel** specifiers (no dot in the last segment) listed in tsconfig `paths`;
  deep imports under a mapped directory are externalized but never published ("Unable to resolve specifier ...").
  Hence `app/config`, `app/core/auth`, `app/core/util`, `app/core/request`, `app/shared/alert`, `app/shared/auth`,
  `app/shared/date`, `app/shared/language`, `app/shared/pagination`, `app/shared/sort` are barrels with explicit
  `paths` entries and all templates import them as barrels. Shared mapping bundles are compiled standalone: type
  augmentations (dayjs plugins) and `define`s (`SERVER_API_URL`, `__VERSION__`) must come from the module itself /
  the esbuild plugins, not from `angular.json` `define`.
- A module that is part of a shared barrel's import graph must never import that barrel itself (lesson from the
  former webpack module federation, still valid): the app hangs at bootstrap with a blank page and no console
  error (every Cypress spec of a `microfrontend: true` sample fails on `[data-cy="navbar"]`). Example: for oauth2,
  `core/auth/user-route-access.service.ts` used `LoginService` (`app/login/login.service.ts`), which imports
  `app/core/auth` — fixed by redirecting to `oauth2/authorization/oidc` directly in the guard. Do **not** fix such
  cycles by importing concrete files (`app/core/auth/account.service`): only the barrel specifier is published.
  Bisect by trimming the shared mappings list and rebuilding.
- Shared mappings are built as separate packages, so anything a mapping imports is bundled a second time into
  `app_shared_*-*.js`. Consequences:
  - `provideMicrofrontendTranslation()` must be registered from `app.config.ts`, never from
    `app/shared/language/translation.provider.ts`: from the mapping, the loader, `app/core/microfrontend` and the
    federation runtime get an uninitialised runtime copy and `loadRemoteModule` never settles (no `[NF]` log at
    all). Symptom: `reloadLang` resets the dictionary and the menu shows raw keys. Check with
    `grep -l loadMicrofrontends target/classes/static/*.js`: it must be in `bootstrap-*.js`/`main`, not in an
    `app_shared_*` chunk.
  - `shareAll` shares only the package names of `package.json`, and the unused-dependency scan records the
    _imported specifier_ — `import dayjs from 'dayjs/esm'` never matches the `dayjs` key, so every mapping bundle
    (`app/shared/date`, `app/shared/language`, …) got a private dayjs copy without the plugins/locales registered
    by `app/config/dayjs` (`TypeError: a.duration is not a function` in `app_shared_date-*.js`).
    `federation.config.ts.ejs` therefore shares `dayjs/esm`, its plugins and `dayjs/esm/locale/<dayjsLocale>`
    explicitly (`shareDayjs`). The plugin/locale entries must carry `includeSecondaries: { keepAll: true }`: the
    unused-dependency scan starts from the _exposed_ modules (entity routes/navbar), which never import
    `customParseFormat` or the locales, so without the opt-out (`removeUnusedDeps` keeps an entry only when
    `includeSecondaries` is truthy — the same trick `@angular/core` uses) those entries are dropped from the import
    map while `bootstrap-*.js` still imports them bare, and the app dies at startup with `Unable to resolve
specifier 'dayjs/esm/plugin/customParseFormat'` (every Cypress spec fails on `[data-cy="navbar"]`). Verify
    both halves after `npm run webapp:prod`: `remoteEntry.json` lists all six `dayjs/esm…` entries with existing
    files, `grep -l '$isDayjsObject' build/generated/webapp/*.js` lists a single file, **and** the app bootstraps —
    serve `build/generated/webapp` with a stub (401 `/api/account`, `/management/info`) and run a one-test Cypress
    spec asserting `[data-cy="navbar"]` (a `TypeError`-free build can still fail to start). The mapping bundles
    only appear when the app has entities, so an entity-less sample does not reproduce it.
- Native federation's `shareAngularLocales()` hardcodes a cwd-relative
  `node_modules/@angular/common/locales/<locale>.js` entry point, which breaks in npm workspaces (hoisted
  `node_modules`, used by the `ms-*`/`mf-*` CI samples): "Could not resolve
  node_modules/@angular/common/locales/en.js". `federation.config.ts.ejs` therefore shares the locales with a plain
  `share({ '@angular/common/locales/<locale>': { requiredVersion: 'auto', includeSecondaries: false } })` helper so
  the entry point is inferred by node resolution.

### Native federation runtime

- When an application exposes itself (`exposeMicrofrontend`, the gateway is its own `self` microfrontend and
  routes/navbar go through `loadEntityRoutes('<name>')`/`loadNavbarItems('<name>')`),
  `initFederation(remotes, { hostRemoteEntry })` must set `hostRemoteEntry.name` to the module federation name.
  Without it the orchestrator registers the host as `__NF-HOST__` and `loadRemoteModule('gateway', …)` throws
  `NFError: Remote 'gateway' is not initialized`; the router then retries the lazy route endlessly, the tab
  freezes, Cypress prints nothing and the CI "E2E: Run" step times out after 15 minutes (locally the Electron
  renderer crashes after ~4 min).
- Translations: the esbuild `translatePartialLoader` only loads the application's own `loadLocale(lang)`. For
  microfrontend apps `app/core/microfrontend/microfrontend-translation.loader.ts` provides
  `MicrofrontendTranslationLoader` (a `TranslateLoader` that also merges each remote's exposed `./i18n` when its
  `loadMicrofrontends` signal is on) and `provideMicrofrontendTranslation()`: it overrides `TranslateLoader` and an
  app initializer `effect` flips the signal from `accountService.account()` and calls
  `translateService.reloadLang(lang).subscribe()`, so remote dictionaries are fetched only after login (and again
  on every language switch while logged in). The loader owns its own signal because `AccountService` injects
  `TranslateService` (a loader injecting `AccountService` would be a DI cycle). Do not gate features on
  `microfrontends.some(remote => !remote.self)`; provide an empty array/noop instead.

- `ng e2e` cannot drive the native federation dev server: `@cypress/schematic` schedules the `devServerTarget` with
  `watch: false` and waits for an output carrying `baseUrl`, but the native federation builder (`runBuilder` in
  `@angular-architects/native-federation`) skips the initial dev-server output (`if (first || !watch) continue;`) and
  only yields on rebuilds, so `ng e2e --configuration coverage|run` hangs until the job times out (the dev-server
  workflow's `ng-default-module-federation` job ran 40 min). The `serve` target also needs `configurations`
  (`development`/`production` overriding `target` to `serve-original:<config>`), otherwise Cypress' `coverage`
  configuration fails with "Configuration 'development' for target 'serve' … is not set". For microfrontend Angular
  apps the cypress generator therefore emits the generic script (`concurrently … npm:start "wait-on … && npm run
e2e:headless -- -c baseUrl=…"`), probing `http-get://localhost:<port>` because the Angular dev server binds
  `localhost` only (`[::1]` on macOS — `127.0.0.1` never answers; Vite uses `host: true`, so Vue/React keep
  `127.0.0.1`). Local check: stub backend on 8080, `npm start`, `npx wait-on http-get://localhost:4200`, then a
  one-test navbar Cypress spec with `-c baseUrl=http://localhost:4200`.

### Horizontal scroll hunting in generated Angular apps

- Electron/Cypress and macOS browsers use overlay scrollbars, so `documentElement.scrollWidth > clientWidth` is
  the reliable check; measure many pages, widths (320–1920) and states (modals, open dropdowns, collapsed navbar,
  short viewports that force a vertical scrollbar) and list elements whose `getBoundingClientRect().right`
  exceeds `clientWidth` to find the culprit.
- `class="table table-responsive d-table"` cancels itself: `d-table` overrides the `display: block` that makes
  `.table-responsive` scroll, so long unbreakable cell content widens the page instead. The `/admin/configuration`
  page did this with long Spring property keys below ~640px; the fix was the `break` class (`word-break: break-all`
  from `global.scss`) on the prefix and property-key cells rather than a wrapper.
- The entity list tables are wrapped in `div.table-responsive`, so a wide table only scrolls inside its wrapper;
  that is not a page-level horizontal scroll.
- Safari only (WebKit, not reproducible in Chromium, Firefox or Playwright's WebKit build): an ng-bootstrap
  `ngbDropdown` with `display="dynamic"` inside a `position: relative` navbar `li` makes the page horizontally
  scrollable once opened, and the value sticks after closing. Popper writes the menu position as inline styles,
  WebKit's "positioned movement only" layout then records the menu's scrollable overflow at
  `2 × containingBlockLeft + menuWidth` and never recomputes it. The fix in `navbar.html.ejs` is
  `display="static"` on the navbar dropdowns (pure Bootstrap CSS positioning, identical placement) plus
  `dropdown-menu-end` on the right-aligned account and language menus. Real Safari can be driven with
  `selenium-webdriver` once "Develop → Allow Remote Automation" is enabled; `safaridriver --enable` needs sudo.

## Vue client

- `@content` is used only by the rsbuild bundler variant (see the conventions section): `rsbuild.config.ts` needs
  the alias, Vite uses absolute `/content/…` URLs.
- With `resolve.tsconfigPaths: true` in `vite.config.ts`, tsconfig `paths` only reach Vite's own resolver. The
  `@module-federation/vite` plugin resolves `shared` keys itself, so application modules shared by key
  (`@/shared/jhipster/constants`, …) fail with "Rolldown failed to resolve import … from virtual:mf:…loadShare…"
  unless `shareMappings` adds `import: './src/main/webapp/app/…'` (as the React template does). Reproduce with a
  monolith `microfrontend: true, exposeMicrofrontend: true, clientBundler: vite` and `npm run webapp:build:prod`.
- Vite dev-server e2e flakiness (`devserver.yml`): see [Debugging CI failures](#debugging-ci-failures).

## React client

- Update pages must navigate back via a `useEffect` on `updateSuccess` (redux state), never directly after
  dispatching the save: navigating while the PUT is in flight lets follow-up requests (e.g. cypress `afterEach`
  cleanup) race the save on the server.
- Since 9.2.1 React is Vite-only (`generators/react/templates/vite.config.ts.ejs`, needle
  `jhipster-needle-add-vite-config`); `clientBundler: webpack` is dropped from `.yo-rc.json` and `devServerPort` is
  reset to `9000 + applicationIndex` in the react `configuring` phase. Old `webpack/*` files are removed by
  `generators/react/cleanup.ts`. Microfrontends use `@module-federation/vite` with `module-federation.config.ts`;
  the gateway registers remotes via `registerRemotes` in `index.tsx` and loads them with `loadRemote`.
  Translations are bundled by `client/generators/i18n/.../index_vite.js` (needs `deepmerge`) for both monoliths and
  microfrontends. To verify: generate a monolith plus a gateway/microservice pair from a JDL, `npm install`, then
  `npm run webapp:build:dev` and `npm test` in each app.
- `@module-federation/vite` only proxies a shared module to the host when it can resolve it: for app-local modules
  (`app/config/store`, …) the `shared` entry needs `import: './src/main/webapp/<key>'` (see `shareMappings` in
  `module-federation.config.ts.ejs`); without it the remote silently uses its own copy. Even so, remotes must get
  host state from React context (`useStore()` from the shared `react-redux`, see `entities/routes.tsx.ejs`), never
  from module singletons like `getStore()`. Symptom when this breaks: the remote injects its reducers into its own
  store and selectors throw `Cannot read properties of undefined` for the microservice key.
- Microfrontend translations: each remote registers its own `i18n/<locale>/<locale>.js` into the shared
  `TranslatorContext` from a top-level `await registerTranslations()` in its exposed `entities/menu.tsx` and
  `entities/routes.tsx` (`app/shared/reducers/locale.ts.ejs`). The loader must memoize the pending _promise_ per
  locale, not a "done" flag: the menu and routes modules load concurrently, and a flag lets the second caller
  resolve before the i18n chunk arrives, so the page renders `translation-not-found[...]` and never re-renders
  (react-jhipster's `Translate` is a class component that only re-renders with its parent). This only shows up
  with CI-like latency; reproduce it by delaying the remote's `assets/en-*.js` response a few seconds in the stub
  server.
- The development ribbon (`shared/layout/header/header.scss.ejs`) must stay below react-toastify's container
  (`--toastify-z-index: 9999`): with a higher z-index the translucent ribbon paints over the top-left toasts and
  hides the second line of the message (e.g. the entity id of "A Blog is updated with identifier …").
  react-toastify 11 renders the message as a bare text node inside the flex toast (no `.Toastify__toast-body`), so
  two-line wrapping at 320px is normal.

## Spring Boot server

- `LoggingAspect.java.ejs` is shared by imperative and reactive apps. For reactive apps the around advice logs
  `Mono`/`Flux` on termination (`doOnSuccess`/`doOnComplete`/`doOnError`) and also handles synchronous throws
  itself: an `@AfterThrowing` advice needs `ExposeInvocationInterceptor.currentInvocation()`, which is not set when
  the reactive `@Transactional` interceptor invokes the target lazily at subscribe time, so it fails with
  "No MethodInvocation found" and turns a `BadRequestAlertException` into a 500 (visible in `*ResourceIT`
  create/update-with-invalid-id tests). Validate aspect changes by generating a reactive app, removing
  `@Profile(dev)` from `LoggingAspectConfiguration` and raising the package log level to DEBUG in
  `src/test/resources/config/application.yml`, then running one `*ResourceIT`.
- Reactive applications cannot enable a cache provider — the cache generator throws
  (`generators/spring-boot/generators/cache/generator.ts`).
- Reactive SQL persistence (`generators/spring-boot/generators/data-relational`) is plain Spring Data R2DBC. Entities
  without eager to-one relationships, many-to-many link tables, `*WithEagerRelationships` APIs, JPA-metamodel
  filtering or maps-id get a bare `R2dbcRepository` interface (`_entityClass_Repository_r2dbc.java.ejs`; decided by
  `useSimpleR2dbcRepository()` in `entity-files.ts`, overridable per entity with `entityR2dbcRepository`). The others
  get `<Entity>RepositoryInternal` plus a thin `<Entity>RepositoryInternalImpl extends AbstractR2dbcRepository`
  fragment (constructor `R2dbcEntityTemplate, R2dbcConverter, R2dbcDialect`). The generic machinery lives in the
  once-per-app `repository/AbstractR2dbcRepository` (`AbstractR2dbcRepository_reactive.java.ejs`, written when any
  entity needs a fragment) which extends `SimpleR2dbcRepository`: `findAll`/`findById`/`findAllBy(Pageable)` run
  `populateRelationships` after the query, `populate(entities, fkGetter, RelatedType.class, relatedIdGetter, setter)`
  loads a to-one relationship with one `Criteria.where(id).in(ids)` query, `populate(entities, <REL>_JOIN_TABLE,
RelatedType.class, relatedIdGetter, setter)` loads an owner-side many-to-many with two queries (join table rows
  `IN (:entityIds)` via `DatabaseClient`, then the related entities), `reference(entities, fkGetter, Related::new,
Related::setId, setter)` fills a non-eager to-one with an id-only related entity and no query (the same JSON an
  imperative app produces for a lazy relationship, thanks to `SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS` in
  `JacksonHibernateConfiguration`), `save`/`deleteById` maintain the
  `JoinTable` records returned by `joinTables()` through `DatabaseClient`, `findAllBy(Criteria,
Pageable)`/`countBy(Criteria)` back the filtering (the fragment builds the `Criteria` from the JHipster `Filter`s
  with the generated `repository/CriteriaBuilder`, using entity property names so the custom converters apply), and
  sorting by a related property (`relationship.field`) falls back to the fragment's
  `selectWithRelationsSql()`/`sortColumns()` constants (`SELECT e.* … LEFT JOIN … ORDER BY` plus
  `dialect.limit().getLimitOffset()`). The per-entity template therefore only emits those constants,
  `populateRelationships`, `joinTables()`, the maps-id `save` override and `buildCriteria`. The former
  `EntityManager`, `*SqlHelper`, `rowmapper/*RowMapper`, `ColumnConverter` classes and the
  `UpdateMapper`/`SqlRenderer` beans are gone (cleanup entries under `9.3.1`); ITs inject `R2dbcEntityTemplate em` and
  use `em.insert(entity)`, `em.delete(X.class).all()` and `template.getDatabaseClient().sql("DELETE FROM <link table>")`.
- Which reactive relationships are loaded is decided by `relationship.relationshipEagerLoad` (`entity.eagerRelations`),
  exactly like the imperative entity graphs: eager to-one (display field differs from the id, or explicit
  `relationshipEagerLoad`) is queried, non-eager to-one is referenced by id, owner-side many-to-many (always eager) is
  populated from the join table. Eager inverse sides (one-to-many, non-owner one-to-one) are still not populated in
  reactive apps. The former `reactiveEagerRelations`/`regularEagerRelations`/`reactiveRegularEagerRelations` entity
  properties were removed (unused or misnamed); where the templates need "to-one with the foreign key on this table"
  (criteria filtering, `SORT_COLUMNS`, `filterTestableRelationships` in `_entityClass_ResourceIT`) they use
  `relationships.filter(rel => rel.ownerSide && !rel.collection)`. `SELECT_WITH_RELATIONS_SQL` only joins eager
  to-one tables; a sort by a non-eager `rel.id` maps to `e.<fk column>` without a join. The `sql` entity set has no
  id-only to-one relationship, so to exercise `reference()` set `"otherEntityField": "id"` on `Operation.bankAccount`
  in a copied `.jhipster/Operation.json`; a small IT saving an `Operation` with a `BankAccount` and two `Label`s and
  reading it back through `findById`, `findAllBy(PageRequest.of(0, 10, Sort.by(DESC, "bankAccount.id")))` and
  `findAll()` verifies the id-only reference, the populated `labels` and the join-free sort.
- `entityPackage` entities whose ITs reference another package (`User`, other `*ResourceIT.createEntity()`) do not
  test-compile: `_entityClass_ResourceIT.java.ejs` imports related domain classes and repositories from
  `entityAbsolutePackage` instead of `otherEntity.entityAbsolutePackage` and never imports other `*ResourceIT`
  classes. Pre-existing; keep verification samples in a single package unless that is what is being fixed.
- Known reactive SQL limitations, visible with the `sqlfull` entity set and failing identically before and after the
  R2DBC rewrite (so not regressions): entities without any field of their own (only an id and nullable to-one
  relationships) fail on H2 with `INSERT INTO t VALUES (DEFAULT)` (Spring Data R2DBC omits null columns; PostgreSQL
  accepts the statement) and `UPDATE contains no assignments` (`TestManyToOne`, `TestPagination`, `TestManyToMany`
  PUT/PATCH, …); maps-id grandchildren fail because the IT creates the parent with `em.insert(createEntity(em))`,
  bypassing the repository `save` that copies the maps-id id (`NULL not allowed for column "ID"`); entities with a
  required many-to-many fail in `@AfterEach` because `repository.delete(entity)` runs the base
  `SimpleR2dbcRepository.deleteById`, not the fragment override that clears the link table (FK violation), and the
  leftover rows then break the following filter assertions (`Expected: is <1> but: was <2>`); the JPA-filtering IT of
  an entity with several relationships to the same entity does not compile (duplicate `@Autowired` field, undefined
  `<rel>Id` variable). CI's reactive sample (`webflux-psql` with the `sql` entity set) hits none of these.

### Cassandra migrations: Liquibase (default) and the CQL loader

- Design: `databaseMigration` defaults to `liquibase` for Cassandra; `data-cassandra` composes
  `jhipster:spring-boot:liquibase`. The initial schema (`liquibase/templates/.../initial_schema_cassandra.xml.ejs`)
  uses regular `<createTable>` changes and `<loadData>` from `config/liquibase/data/user.csv`,
  `user_by_login.csv`, `user_by_email.csv` (CQL collection types are escaped in the `type` attribute:
  `set&lt;text&gt;`; the `authorities` set literal is a `type="computed"` column and the loads use
  `usePreparedStatements="false"` so the statements stay plain CQL). The `user_by_activation_key`,
  `user_by_reset_key` and `activation_key_by_creation_date` tables are `generateUserManagement`-only — the
  Cassandra `UserRepository.java.ejs` prepares their statements in its constructor, so its activation/reset key
  fields, statements, finders and save/delete/deleteAll branches are gated the same way — and `persistent_token*`
  follow the `PersistentTokenRepository` condition (`generateUserManagement && authenticationTypeSession &&
!reactive`). The `user` columns `password`/`activation_key`/`reset_key`/`reset_date` stay unconditional
  because `User.java.ejs` maps them unconditionally. The per-entity changelogs
  (`data-cassandra/templates/.../config/liquibase/changelog/added_entity.xml.ejs`, registered through
  `source.addLiquibaseChangelog`) are `<createTable>` changes too, with the CQL type per field type computed in the
  template. Liquibase's `UUIDType` renders `uuid` as `char(36)` on Cassandra (only `text` has a Cassandra data type
  in `liquibase-cassandra` 5.0.4; unknown names such as `timeuuid`, `set<text>`, `tuple<timestamp,varchar>` pass
  through as `UnknownType`, known ones render uppercase, which CQL accepts), and a dbms-scoped
  `<property name="uuidType" value="uuid" dbms="cassandra"/>` does not help because the substituted `uuid` is
  parsed again into `UUIDType`. Cassandra entities default to a UUID id (`defaultPrimaryKeyType` in
  `generators/server/support/database.ts`), so the entity changeSet appends
  `<modifySql><replace replace="char(36)" with="uuid"/></modifySql>` whenever a field is a UUID; the proper fix is a
  `CassandraUuidDataType` in `liquibase-cassandra`. `createTable ifNotExists="true"` is silently dropped because
  `Database.supportsCreateIfNotExists` defaults to `false` and `CassandraDatabase` does not override it; no
  precondition replaces it, the changelog table already records whether the changeSet ran.
  The `liquibase-cassandra` extension only swaps the runner: the physical model (`user`, `user_by_*` lookup tables,
  `authorities set<text>`, entity tables with CQL types) is unchanged.
- Recipe to see the CQL Liquibase will emit for a changelog without a database: resolve a classpath with a scratch
  pom holding `liquibase-core` + `liquibase-cassandra` (`mvn -o dependency:build-classpath
-Dmdep.outputFile=cp.txt`, both are in `~/.m2` after a Cassandra sample build), then run a single-file Java
  program (`java -cp "$(cat cp.txt)" Probe.java changelog.xml`) that opens
  `DatabaseFactory.getInstance().openDatabase("offline:cassandra", …)` and calls `liquibase.update(contexts, labels,
writer)`. Do not launch `liquibase.integration.commandline.LiquibaseCommandLine` directly with that classpath: the
  JDK 25 launcher fails with a misleading "JavaFX runtime components are missing" message. Offline mode writes a
  `databasechangelog.csv` next to the working directory; delete it between runs or the second run fails checksum
  validation for the edited changeSets. Preconditions are not evaluated offline (the changeSet always renders).
  `LiquibaseConfiguration` builds a `SimpleDriverDataSource` on `com.ing.data.cassandra.jdbc.CassandraDriver`
  (transitive from `liquibase-cassandra`) from `CassandraConnectionDetails` + `spring.cassandra.keyspace-name`, so
  Testcontainers' `@ServiceConnection` works without a `spring.liquibase.url`. Liquibase runs synchronously and
  the Cassandra `UserRepository` is `@DependsOn("liquibase")` because its constructor prepares statements
  at startup. Liquibase cannot create the keyspace (the jdbc url and the `DATABASECHANGELOG*` tables live inside
  it), so the application creates it itself: `DatabaseConfiguration.java.ejs` declares a
  `CqlSessionBuilderCustomizer` bean (`keyspaceCreator`) that opens a keyspace-less session from the same builder
  (`builder.withKeyspace((CqlIdentifier) null).build()`), runs `CREATE KEYSPACE IF NOT EXISTS … WITH replication =
<application.cassandra.keyspace-replication>` (a `String` added to `ApplicationProperties` through
  `source.addApplicationPropertiesClass`, default `SimpleStrategy`/factor 1, documented in `application-prod.yml`),
  then binds the builder back to `spring.cassandra.keyspace-name`. The bean is
  `@ConditionalOnProperty(name = "application.cassandra.create-keyspace", havingValue = "true", matchIfMissing = true)`
  (a `Boolean createKeyspace = true` in the same `ApplicationProperties.Cassandra` class) so an externally managed
  keyspace can turn it off. Boot's `cassandraSessionBuilder` applies
  customizers after `withKeyspace`, so the customizer must restore the keyspace. Ordering: user `@Configuration`
  beans are instantiated before auto-configured ones, so the `liquibase` bean would run before `cassandraSession`
  and fail on the missing keyspace — `LiquibaseConfiguration` therefore injects the `CqlSession` and reads the
  keyspace from `session.getKeyspace()` instead of `CassandraProperties`. Consequently the docker
  `cassandra-migration` service, its `Cassandra-Migration.Dockerfile`/`autoMigrate.sh`/`execute-cql.sh`, the
  `create-keyspace*.cql`/`drop-keyspace.cql` resources, the `docker-compose` merge of `cassandra-migration.yml` and
  `CassandraTestContainer.createKeyspace` are all `databaseMigrationLoader`-only; `generators/docker/generator.ts`
  and `data-cassandra/generator.ts` remove the previously generated files through `'9.3.1'` `control.cleanupFiles`
  entries gated on `databaseTypeCassandra && databaseMigrationLiquibase`. The Kubernetes generator never created a
  keyspace, so application-side creation is what makes Liquibase Cassandra apps start there.
- Cassandra user lookup tables and the reactive `save`: `user_by_login` and `user_by_email` are declared
  `PRIMARY KEY(login, id)` / `PRIMARY KEY(email, id)` (both in `create-tables.cql.ejs` and
  `initial_schema_cassandra.xml.ejs`), so `id` is a clustering column and a login can hold several rows.
  `UserRepository.findOneFromIndex` reads only the first row (`rs.one()` / `rows().next()`) and resolves it with
  `findById`, so a stale `(login, oldId)` row whose user no longer exists hides the live one whenever `oldId` sorts
  first — random UUID ids make that a coin flip. The imperative `save` deletes the old lookup rows before its insert
  batch, but the reactive `save` built its cleanup as `Flux<ReactiveResultSet> deleteOps = Flux.empty()` followed by
  `deleteOps.mergeWith(session.execute(...))` whose result was discarded, so no old row was ever deleted (fixed on the
  `cassandra-liquibase` branch by assigning `deleteOps = deleteOps.mergeWith(...)`). Symptom: in a reactive Cassandra
  gateway `UserResourceIT.deleteUser` fails with `Expected size: 4 but was: 5` and `johndoe` still listed, in about
  half of the runs — JUnit's default method order runs `updateUserLogin` (login `johndoe` → `jhipster`) right before
  `deleteUser`, leaving `(johndoe, oldId)` behind, and the `DELETE /api/admin/users/johndoe` then resolves the stale id,
  finds no user and answers 204 without deleting. The reactive Cassandra + JWT gateway only entered CI when the
  `ms-react-consul-jwt-cassandra-redis` JDL switched its gateway from `prodDatabaseType postgresql` to
  `databaseType cassandra` on that branch, so `gh run list -w react.yml -b main` history of the job is not comparable.
- The legacy CQL migration is still selectable as `databaseMigration: 'loader'`, mirroring how Neo4j picks between
  `neo4j-migrations` and Liquibase through the same option. `loader` restores `config/cql/changelog/*` (README,
  `00000000000000_create-tables.cql`, `00000000000001_insert_default_users.cql`, per-entity `added_entity.cql`),
  the `ResourceKeyspacePopulator` and `createKeyspace` in `CassandraTestContainer`, the `config/cql/*keyspace*.cql`
  scripts and the `cassandra-migration` docker service (with `create-keyspace-prod.cql`) in `cassandra.yml.ejs` and
  `cassandra-cluster.yml.ejs`; it also drops the `@DependsOn("liquibase")` on the repositories, since no such bean
  exists. Every liquibase-only
  branch is therefore gated on `databaseMigrationLiquibase`, and the `'9.3.1'` `control.cleanupFiles` entry for the
  CQL changelogs uses the `[condition, ...files]` array form so the files survive under `loader`.
- Existing applications keep the loader: `data-cassandra`'s `configuring` runs a `configMigration` task that sets
  `jhipsterConfig.databaseMigration = 'loader'` when `control.isJhipsterVersionLessThan('9.3.1')` and the stored
  value is not an explicit `liquibase`. Cassandra ignored `databaseMigration` before 9.3.1, so a stored `'no'` also
  means "still on the CQL scripts". This is the same shape as Vue's `clientBundler` pin in `generators/vue/generator.ts`;
  test it with `.withJHipsterConfig({ jhipsterVersion: '9.2.0' }).commitFiles()`, because `control.jhipsterOldVersion`
  reads `jhipsterVersion` from the `.yo-rc.json` **on disk**.
- Adding a value to a command's `choices` array is never a local change: `getCommandDerivedPropertyMutations`
  (`lib/command/mutations.ts`) explodes choices into `<option><Value>` booleans, so a new choice adds a key to every
  application/context snapshot (`databaseMigrationLoader: false` appeared in the angular, react, vue, app, jdl, ci-cd
  and bootstrap snapshots) and changes the CLI help text. Run `npm run update-snapshots` and confirm the diff contains
  nothing but the new key.
- Recipe to prove a config value faithfully restores older behaviour: temporarily add it to the spec's `commonConfig`,
  run `npm run update-snapshot -- <spec>`, then `diff <(git show upstream/main:<snap>) <snap>`. For `loader` the only
  difference was the echoed `"databaseMigration": "loader"` in the samples matrix — every generated file path matched
  upstream. Note `getStateSnapshot()` records paths and state, not contents, so pair it with a throwaway spec that
  greps the rendered files when the change is inside a template. To review rendered files by eye, dump
  `runResult.getSnapshot()` (its entries carry `contents`) to a scratch directory from a throwaway spec; copying
  `runResult.cwd` yields nothing because `runJHipster` keeps the files in memory unless `.commitFiles()` is used, and
  a bare `helpers.runJHipster('server')` needs `skipClient: true` or the languages generator fails on missing
  webapp files.
- `prepareSqlApplicationProperties` (`data-relational/support/application-properties.ts`) must run for Cassandra
  too (it sets `devJdbcDriver`/`prodJdbcDriver` to the wrapper driver and empty credentials), otherwise the Gradle
  `liquibase.gradle.ejs` rendering throws `ReferenceError: devJdbcDriver`. `cassandraKeyspaceName` is an
  `applicationDefaults` property (`generators/spring-boot/application.ts`), so every application snapshot lists it
  (`undefined` outside Cassandra) — refresh e.g. the ci-cd context snapshot when it appears.
- Changelog lock, part 1 — affected-row count: the generated JDBC URL must contain `compliancemode=Liquibase`
  (`LiquibaseConfiguration.java.ejs` and `prodLiquibaseUrl` in `generators/liquibase/generator.ts`). With the
  `cassandra-jdbc-wrapper` default option set `executeUpdate` returns `0` for the lock's LWT
  `UPDATE ... IF LOCKED = FALSE`, and `LockServiceCassandra.acquireLock` (5.0.3 and 5.0.4) treats `0` as "another
  node was faster" although the lock was applied, so every app start loops on `Waiting for changelog lock....`
  until `Could not acquire change log lock. Currently locked by <own host>` (upstream
  liquibase/liquibase-cassandra#379, fix PR #492 unreleased). The Liquibase option set returns `-1`, which the
  extension verifies against `LOCKEDBY`.
- Changelog lock, part 2 — quorum: the LWT needs a quorum of the keyspace replicas, so on the single-node docker
  compose the keyspace must have replication factor 1; a factor of 3 fails with `UnavailableException: Not enough
replicas available for query at consistency QUORUM (2 required but only 1 alive)` and the e2e app never starts.
  This is why the application-created keyspace defaults to `{'class': 'SimpleStrategy', 'replication_factor': 1}`
  and a real cluster is expected to pre-create the keyspace (the `IF NOT EXISTS` is then a no-op) or override
  `application.cassandra.keyspace-replication`.
- The 2s default request timeout bites twice, and both are schema changes needing schema agreement, which does not
  fit in 2s on a loaded CI runner. (1) `CREATE KEYSPACE`: the application's `keyspaceCreator` customizer uses a
  `SimpleStatement…setTimeout(Duration.ofSeconds(20))`, and the loader-only `CassandraTestContainer.createKeyspace`
  (run from `containerIsStarted`, where a `DriverTimeoutException` makes testcontainers retry until the limit and
  surface the misleading `ContainerLaunchException: Container startup failed for image cassandra:6.0`) gives its
  `CqlSession` a `DriverConfigLoader` with `DefaultDriverOption.REQUEST_TIMEOUT`. (2) Liquibase's own connection goes through the
  `cassandra-jdbc-wrapper`, which ignores the driver config and defaults to 2s, failing a changeSet with
  `DatabaseException: ... Query timed out after PT2S [Failed SQL: (0) CREATE TABLE ...]`; fix it with the
  `requesttimeout` **url** parameter on both generated jdbc urls (`LiquibaseConfiguration.java.ejs` at runtime and
  `prodLiquibaseUrl` in `generators/liquibase/generator.ts` for the maven/gradle plugin). A symptom that reads as a
  container or startup problem is usually this timeout.
- Confirming an unfamiliar jdbc url parameter without guessing: `javap -p -constants
com/ing/data/cassandra/jdbc/utils/JdbcUrlUtil.class` from the jar in `~/.m2` lists the real keys
  (`KEY_REQUEST_TIMEOUT = "requesttimeout"`), and `javap -p -c .../SessionHolder.class` shows the unit —
  `ChronoUnit.MILLIS` into `DefaultDriverOption.REQUEST_TIMEOUT`, applied only when positive. Prove it end to end by
  setting the value to `1` in a generated app: the failure becomes `Query timed out after PT0.001S`, which confirms
  both that the parameter is read and what unit it is in.
- Verification recipe: generate a Maven Cassandra app and run `./mvnw verify` (Testcontainers `cassandra:6.0`).
  Do not run a second Cassandra container on the same Docker Desktop while the IT runs — the Testcontainers node
  dies with `Failed to commit memory`. `failsafe:integration-test` alone does not recompile edited sources; run
  `compile` first. For quick Liquibase-vs-Cassandra experiments write a plain `main` using the Liquibase API
  (`LockServiceFactory`, `Executor.queryForList` on `DATABASECHANGELOGLOCK`) on the app's
  `dependency:build-classpath -Dmdep.includeScope=test` classpath.
- Cassandra `UserRepository` lives in the data-cassandra generator
  (`data-cassandra/templates/src/main/java/_package_/_entityPackage_/repository/UserRepository.java.ejs`, written by
  `writeEntityCassandraFiles` for `entity.builtInUser` next to `domainFiles`), and the reactive SQL one in the
  data-relational generator (`data-relational/templates/.../repository/UserRepository_reactive.java.ejs`, a
  `builtInUser` block in `writeEntitiesTask` next to the `_persistClass_Callback` one; the `_reactive` suffix is
  stripped on write like the other reactive templates there), and the Couchbase one in the data-couchbase
  generator (`data-couchbase/templates/.../repository/UserRepository.java.ejs`, a `userFiles` block of its
  `entityFiles` section gated on `builtInUser && generateBuiltInUserEntity`, since that writer runs for every
  entity). The common `spring-boot/templates/.../repository/UserRepository.java.ejs` only holds the Spring Data
  JPA, MongoDB and Neo4j variants and is skipped for Cassandra, Couchbase and reactive SQL in
  `spring-boot/entity-files.ts`. That common template no longer branches on the database for the supertype: it
  renders `application.springBootBaseRepositoryClass` / `springBootBaseRepositoryImport` (optional on the Spring
  Boot `Application` type), which every `data-*` generator sets through `applicationDefaults` in a `preparing`
  task (`JpaRepository`/`R2dbcRepository`, `[Reactive]MongoRepository`, `[Reactive]Neo4jRepository`,
  `[Reactive]CassandraRepository`, `JHipsterCouchbaseRepository` with its `<packageName>.repository` import). The
  `'unknown'` fallback is an `applicationDefaults` in the spring-boot generator's `postPreparing`, not in
  `mutateApplicationPreparing`: the parent's preparing runs before the composed children's, and
  `applicationDefaults` never overrides a defined value, so a fallback set in preparing would win. For that,
  `POST_PREPARING` was added to `PRIORITY_WITH_APPLICATION_DEFAULTS` in `base-simple-application` and
  `base-application` (`PostPreparingTaskParam` now carries `applicationDefaults`); before, only `loading` and
  `preparing` tasks received it. The common `PersistentTokenRepository.java.ejs` (session auth, JPA/MongoDB/Neo4j interface plus the Cassandra class branch) renders the same two properties for its interface variant. Only that class needs
  `@DependsOn("liquibase")`: Spring Data builds repository bean definitions in `RepositoryBeanDefinitionBuilder` and
  never reads `@DependsOn` from a repository interface, and a `CassandraRepository` prepares its statements on first
  use, so the annotation the entity repositories carried was inert and was removed. To drop the bean-name coupling
  from `UserRepository`, Boot's `@DependsOnDatabaseInitialization` would work but requires importing
  `DatabaseInitializationDependencyConfigurer` explicitly, since `LiquibaseAutoConfiguration` (which imports it) stays
  inactive without a `DataSource` bean or `spring.liquibase.url`.

## Blob fields and content types

- Every `Blob`/`AnyBlob`/`ImageBlob` field carries a `<field>ContentType` `String` companion
  (`field.fieldWithContentType`, `field.contentTypeFieldName` in `base-application/support/prepare-field.ts`).
  The shared client helper `openFile` in
  `generators/client/generators/common/templates/src/main/webapp/app/shared/jhipster/data-utils.ts.ejs` (Angular's
  `DataUtils`, Vue's `data-utils.service.ts` and the React entity pages all delegate to it) builds a `Blob` from the
  stored bytes and opens it with `globalThis.open(URL.createObjectURL(blob))`. A `blob:` document is same-origin with
  the page and inherits its CSP, and the generated CSP allows `'unsafe-inline'`, so a stored `text/html` (or SVG/XML)
  blob was a stored XSS against whoever clicked "open" (advisory GHSA-9ffp-22j7-56r2, present since JHipster 5). The
  fix on `advisory-fix-1`: `toOpenableContentType` renders only `application/pdf`, `text/plain`, `image/*`, `audio/*`,
  `video/*` and never a `+xml` type; everything else (including an empty type, which the browser would sniff) becomes
  `application/octet-stream`, i.e. a download.
- Server side, `javaContentTypeValidatorsPartial` (`generators/java/application.ts`, `mutateValidatedField`, applied in
  `java/generators/domain/generator.ts` to every field with `fieldValidate || fieldWithContentType`) renders a
  `@Pattern` that rejects `text/html`, `application/xhtml+xml`, `image/svg+xml`, `text/xml` and `application/xml`
  (case-insensitive, with or without parameters) on the domain content type (via the
  `field<Name>ContentTypeAnnotationSection` fragment of `_persistClass_.java.jhi.jakarta_validation.ejs`) and on the
  DTO. `anyPropertyHasValidation` is also true for entities that only have blob fields, which is what puts `@Valid` on
  the REST resource and the `jakarta.validation` import on the domain class. The entity ITs use `image/jpg`/`image/png`,
  Liquibase fake data `image/png` and Cypress `'unknown'`, all of which pass the deny list.

## Server-side user caches

- Cache names: `usersByLogin` / `usersByEmail` (constants on `UserRepository`).
- Design rule: the plain finders `findOneByLogin` / `findOneByEmailIgnoreCase` are **uncached** and used by
  uniqueness checks and write flows; caching belongs on the `findOneWithAuthoritiesByLogin` /
  `findOneWithAuthoritiesByEmailIgnoreCase` variants used by read and authentication paths. Rationale: a
  `@Cacheable` lookup racing a concurrent eviction (DELETE while an update is in flight) repopulates the cache
  with a stale user, and later creations fail with `login-already-used` / `email-already-used` even though the
  database row is gone.

## Testing and samples

- `lib/testing/helpers.ts`: the `jhipster` preset injects `skipChecks`, `reproducibleTests`, `skipInstall`,
  `skipGit`, `useVersionPlaceholders`. `defaultHelpers` adds `skipPrettier` + `dryRun`; most specs use it.
  `withJHipsterGenerators()` wires real generators, mocks via `withMockedJHipsterGenerators`. Per-test environment
  lookup is cheap (~10 ms); module import of `cli/environment-builder.ts` (~1 s) happens once per mocha worker.
- Specs are run with esmocha (`npm test` = `esmocha test generators cli .blueprint lib --forbid-only`, update
  snapshots with `--update-snapshot`), not vitest. `test/api.spec.ts` needs `dist/` (`npm run build`).
- Git worktrees must live in a directory named `generator-jhipster` (for example `<scratch>/wt/generator-jhipster`):
  yeoman derives the generator namespace from the package folder name, so in a worktree called anything else every
  spec that boots the CLI/environment fails with `You don't seem to have a generator with the name
"generator-jhipster" installed` (`cli/environment-builder.ts` even says "make sure your folder is called
  generator-jhipster"). `npm ci --ignore-scripts` is enough to run the esmocha specs there. Always check
  `git branch --show-current` before trusting a "passes locally": the main checkout may be on another branch than
  the PR being fixed.
- Sample apps for manual testing: `bin/jhipster.cjs generate-sample <name>` (JIT dev blueprint). Workflow samples
  come from `.blueprint/generate-sample/templates/test-integration/workflow-samples/*.json` (`app-sample` points
  to `…/samples/<name>/.yo-rc.json`, `entity` to the entity sets in
  `.blueprint/generate-sample/support/copy-entity-samples.ts` `entitiesByType`, the JSON entities live in
  `…/samples/.jhipster/`); daily-build sample names need the `daily-` prefix and the daily builds themselves run in
  `hipster-labs/jhipster-daily-builds`. Quirk: `--sample-yorc-folder` copies the sample `.yo-rc.json` into the
  **current working directory**, not the `--project-folder` — run it from the target folder, or stage
  `.yo-rc.json` plus `.jhipster/*.json` manually and run plain `jhipster` there (with `.jhipster/` present the app
  generator regenerates the entities; `jhipster entities` is the explicit form). `CI=true` suppresses prompts.
- Reactive SQL sample without Docker: copy `test-integration/samples/webflux-psql/.yo-rc.json` (h2Disk dev, postgresql
  prod) plus the `.jhipster/*.json` entities; ITs run with the `testdev` profile against H2
  (`application-testdev.yml`), the Testcontainers path only kicks in with `testprod`. For a server-only run set
  `"clientFramework": "no"` and `"enableTranslation": false` in the copied `.yo-rc.json` instead of passing
  `--skip-client`: with translations enabled `--skip-client` dies in `jhipster:languages#updateLanguages` (`Unable to
find …/find-language-from-key.pipe.ts`). `--skip-prompts` is not a CLI flag (`CI=true` plus `--force` is enough).
  `./mvnw -ntp -o verify -Dskip.installnodenpm -Dskip.npm -Dtest=NoSuchTest -Dsurefire.failIfNoSpecifiedTests=false
-Dit.test=AResourceIT,BResourceIT` runs a subset of ITs; per-class reports land in `target/failsafe-reports/*.txt`.
  For the "identical output" baseline prefer a detached worktree (`git worktree add --detach
<scratch>/base/generator-jhipster HEAD`, symlink `node_modules` from the main checkout) over `git stash`: when a
  long generation is killed by a tool timeout before `git stash pop` runs, the working tree is silently left on the
  baseline.
- Runtime repro of microfrontends without Docker (Angular and React): build gateway + microservices (Gradle output
  is `build/generated/webapp`, Maven `target/classes/static`) or download the `app-<sample>` CI artifact (it
  contains the generated apps) and `npm install` at the workspace root; serve the gateway at `/` and each
  microservice under `/services/<ms>/*` with a tiny Node stub answering `/api/authenticate` (or 401 for
  `/api/account`), `/management/info` and `/services/<ms>/api/*`; then run a Cypress spec on the gateway (navbar
  entity items from the remote, `/blog/blog`, headings translated) with a watchdog — macOS has no `timeout`, use a
  background job + kill. Playwright WebKit with console capture shows the underlying `[NF]` errors. Stub details
  that matter for entity specs: infinite-scroll lists need a `Link` header (`<…>; rel="last",<…>; rel="first"`) or
  the reducer throws reading `length`; success toasts come from `x-<app>app-alert` (translation key) +
  `x-<app>app-params` (id) response headers.
- Running generated-app Cypress from a VS Code-spawned shell: `unset ELECTRON_RUN_AS_NODE` first, otherwise the
  Cypress Electron binary starts in Node mode and dies with `bad option: --no-sandbox`.

## Debugging CI failures

- Reading a failed sample job: `gh run view <run-id> -R jhipster/generator-jhipster --job <job-id> --log` gives the full
  step output, and `gh run download <run-id> -R jhipster/generator-jhipster -n log-<sample-name>` fetches the
  "BACKEND: Store failure logs" artifact (surefire/gradle `test-results/*.xml`, which carry the server-side response body
  that the console log omits when the run sets `-Dlogging.level.ROOT=OFF`). Both need an authenticated `gh`; the plain
  REST API returns 401/403 for logs and artifacts even on this public repo. `check-<framework>` (e.g. `check-react`) is
  only an aggregate gate that re-exports the matrix result — it never carries an independent failure, so ignore it and
  find the real job.
- A workspaces sample such as `ms-react-consul-jwt-cassandra-redis` builds several applications (`gateway`, `blog`,
  `store`, `notification`) and `TESTS: backend` runs `npm run ci:backend:test --workspaces`, which visits them in
  `package.json` order and **does not stop at the first failure**. More than one application can therefore fail in a
  single job — always scan the whole log for every `BUILD FAILED`/`BUILD FAILURE`, not just the last one.
- Before blaming a PR for a sample failure, generate the sample from the PR head and from its merge-base and
  `diff -rq` the two trees (`jhipster jdl <sample>.jdl --skip-install --skip-git --monorepository --workspaces`). An
  application that comes out byte-identical cannot have been broken by the PR, which usually means a Testcontainers or
  runner problem. Typical symptoms: `ContainerLaunchException ... RetryCountExceededException` with
  `DriverTimeoutException: Query timed out after PT2S` (the container never passed its readiness probe), or a 500 whose
  body reads `Cannot connect to localhost/<unresolved>:<mapped-port>`. That string is r2dbc-postgresql's
  `PostgresConnectionException` (no Cassandra driver or Spring Data Cassandra class produces it), so it identifies an
  R2DBC application whose PostgreSQL container died or was reaped mid-run — it was the recurring
  `CucumberTest > User management > Retrieve users` failure of the `ms-react-consul-jwt-cassandra-redis` gateway while
  that gateway was still a PostgreSQL app. The `.yo-rc.json` inside the `app-<sample>` artifact tells which database the
  failing application was really generated with.
  Cross-check `gh run list -w <workflow>.yml -b main` — a consistently green main means the sample is not routinely flaky
  and the run itself was degraded.

- `check-angular` (and siblings) are aggregator jobs over the app matrix — the real error is in an application
  job's log. `gh run view --log-failed` is often empty; download the job log with
  `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs` and grep it.
- Daily builds and PR app jobs surface generated-app compile errors; reproduce locally by generating the failing
  sample (see above) and running its own `npm run webapp:build:dev` / `./gradlew` — faster and more precise than
  reading CI logs. When a regression window is known, `git log upstream/main --since=… --until=…` plus generating
  the sample at both ends of the window and diffing the outputs pinpoints the offending commit quickly.
- `stack-*` / client jobs on Node 22 dying with exit code 134 and `FATAL ERROR: v8::Module::IsGraphAsync must be
used on an instantiated module` during `jhipster.cjs generate-sample` is the Node 22 `require(esm)` crash. The
  workflows' workaround must be a job-level `env: NODE_OPTIONS: …--no-experimental-require-module`; writing it with
  `echo "NODE_OPTIONS=…" >> $GITHUB_ENV` is silently rejected by the runner (`##[error]Can't store NODE_OPTIONS output
parameter using '$GITHUB_ENV' command`, step still shows ✓) and the crash then appears nondeterministically.
- Vite dev-server e2e flakiness (`devserver.yml`, Vue): two dev-only effects hit the Cypress login tests. (1) A
  dependency first imported by a lazily loaded module (`deepmerge` from the i18n bundle) is discovered at runtime,
  Vite re-optimizes and reloads the page — fixed with `optimizeDeps.entries` covering the app sources.
  (2) `router.beforeResolve` calls `hideLogin()`; in dev mode the initial navigation resolves late (lazy route
  component loading), after Cypress opened the login modal, so the modal is closed under the test
  (`[data-cy="username"]` never found, retries pass once modules are cached) — fixed by skipping `hideLogin()` when
  `from === START_LOCATION`. Debug recipe: download the run's `screenshots-*` artifact
  (`gh run download <id> -R jhipster/generator-jhipster`) and check the order of the app init requests
  (`/management/info`, `/api/account`) versus the test clicks in the Cypress log; delay the route import in a
  generated sample (`() => new Promise(r => setTimeout(r, 3000)).then(() => import(...))`) to reproduce init races
  locally.
