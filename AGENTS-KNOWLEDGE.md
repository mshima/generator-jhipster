# Implementation knowledge base for AI agents

Deep-dive notes complementing [`AGENTS.md`](./AGENTS.md). Facts below were verified against the
source tree; when in doubt, re-verify — file paths are the anchors.

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
  keep an `authorities?: string[]` property (special-cased in the Angular model template).
- With translation enabled, `langKey` becomes a **synthetic** enum field (`fieldType: 'Languages'`,
  `fieldValues` from `application.languages`, `skipServer: true`). It exists to type the field and
  drive the update-form select. There are **no i18n entries** for a `Languages` enum — templates
  must not run it through the enum-translation macros (render it as plain text; the Angular model
  types it as `(typeof LANGUAGES)[number]` from `app/config/language.constants`).

## Angular client

- Without an Authority entity (Cassandra/no database) the Angular `UserManagement` gets a built-in
  `authorities` **field** (`fieldType: 'Authority'`, `fieldValues: 'ROLE_ADMIN,ROLE_USER'`, `collection: true`,
  `clientConstantsAsValues: true`, `skipServer: true`) appended in `createUserManagementEntity`; `langKey` is
  also `clientConstantsAsValues`. Such fields are enum-like but produce **no** enum model file and **no** i18n
  enum entries (`addEnumerationFiles`, `generateEntityClientEnumImports` and the client i18n generator skip
  them). `collection` fields are typed `X[]`, default to `[]` in the form service, render as a `multiple`
  select (update) and as badges (list/detail), are not sortable (`fieldSupportsSortBy`), and get array
  samples (`authorities: ['ROLE_USER']`, Cypress `select(['ROLE_USER'])`).
- The Angular generator maps constant-backed field types to their client constants in
  `angularClientConstants` (`generators/angular/generator.ts`): `Languages` → `LANGUAGES` from `app/config`
  (`tsType` `(typeof LANGUAGES)[number]`), `Authority` → `Authority` from `app/shared/jhipster/constants`
  (`tsType` `string`, values `Object.values(Authority)`). The result is exposed as
  `field.angularFieldClientConstant`; `field.angularFieldNameSingular` names loop items (`authority`).
  New Angular-only types/properties must carry an `Angular`/`angular` prefix.
- Refactoring rule: generated code must stay byte-identical unless a real output bug is being fixed.
  Verify with a baseline: `git stash`, generate a sample into the scratchpad from a JDL, `git stash pop`,
  generate again into a sibling directory and `diff -r -q` the trees (ignore `.yo-rc.json`, jwt secrets,
  keystore, `application.yml`). Faker-sequence shifts caused by a genuinely new field are expected.

- User-management pages are generated from the **shared entity templates**
  (`generators/angular/templates/src/main/webapp/app/entities/_entityFolder_/…`) with the entity
  flag `builtInUserManagement`; remaining hand-written pages live under
  `…/app/entities/admin/user-management/`. Grep for `builtInUserManagement` in templates to find the
  existing special cases (langKey typing/rendering, Authority relationship inclusion) before adding
  behavior.
- Translation macros (`__jhiTranslateTag__`, `__jhiTranslateTagEnum__`, `__jhiTranslatePipe__`, …)
  are replaced by `generators/angular/support/translate-angular.ts`. Pitfall: when a key has no
  translation, `getWebappTranslation(key)` falls back to a plain string, and the `TagEnum`/`PipeEnum`
  replacements emit `JSON.stringify(translation)[value]` as inline fallback — indexing a string with
  a string key, which fails Angular strict builds with `TS7015`. Only use the enum macros for keys
  that actually have generated translations.
- Microfrontends use esbuild + `@angular-architects/native-federation` (`clientBundler: esbuild`,
  webpack module federation only remains for `clientBundler: webpack`). Pieces:
  `federation.config.mjs` (shares npm deps via `shareAll`, Angular locales via
  `shareAngularLocales`, app singletons via `sharedMappings`), `tsconfig.federation.json` (exposed
  entries), and `build-plugins` as a local builder package (`./build-plugins:native-federation`)
  wrapping `runBuilder` to inject the esbuild plugins — native federation runs Angular's
  application builder itself, so `@angular-builders/custom-esbuild` plugins would be bypassed.
  `es-module-shims` must be in the `polyfills` list and in `dependencies`; the gateway needs
  `entryPoints` set because it exposes nothing (NF's fallback is `src/main.ts`).
- `build-plugins/` is all TypeScript, including the local Architect builder
  (`native-federation.ts`, referenced from `builders.json`): Architect `import()`s it and Node's
  native type stripping (required Node ≥ 22.18) handles the `.ts`. The package is
  `"type": "module"`, so the esbuild plugins must be ESM-clean — `import.meta.dirname` instead of
  `__dirname`, `createRequire(import.meta.url)` instead of a bare `require` — otherwise the builder
  path fails with "__dirname is not defined in ES module scope" while `@angular-builders/custom-esbuild`
  (non-microfrontend apps, own loader) keeps working and hides the problem.
- `federation.config.ts` is TypeScript without any loader: native federation `import()`s the
  config path itself (`federationConfigPath` builder option) and generated apps require the Node
  version in `generators/init/resources/.node-version` (≥ 22.18), which strips type annotations
  natively. Keep the file to erasable syntax only (annotations, `import type`; no enums, namespaces
  or parameter properties). Do not reach for `jiti/register`: its process-wide hooks also rewrite
  `.json` imports and the Angular CLI fails with "@babel/compat-data/data/native-modules.json … is
  not valid JSON".
- Native federation only shares **barrel** specifiers (no dot in the last segment) listed in
  tsconfig `paths`; deep imports under a mapped directory are externalized but never published
  ("Unable to resolve specifier ..."). Hence `app/config`, `app/core/auth`, `app/core/util`,
  `app/core/request`, `app/shared/alert`, `app/shared/auth`, `app/shared/date`,
  `app/shared/language`, `app/shared/pagination`, `app/shared/sort` are barrels with explicit
  `paths` entries and all templates import them as barrels. Shared mapping bundles are compiled
  standalone: type augmentations (dayjs plugins) and `define`s (`SERVER_API_URL`, `__VERSION__`)
  must come from the module itself / the esbuild plugins, not from `angular.json` `define`.
- The `@angular/build:unit-test` builder uses the build target options only (no custom plugins):
  `vitest-base.config.ts` resolves the virtual `i18n/<lang>.json` modules, and `SERVER_API_URL`
  must also stay in the `angular.json` `define` for the tests.
- Runtime repro without Docker: build gateway + microservices (Gradle output is
  `build/generated/webapp`), serve them with a stub backend mapping `/services/<ms>/*` to the
  microservice static dir, and run a Cypress spec on the gateway (navbar entity items from the
  remote, `/blog/blog`, headings translated).
- Native federation's `shareAngularLocales()` hardcodes a cwd-relative
  `node_modules/@angular/common/locales/<locale>.js` entry point, which breaks in npm workspaces
  (hoisted `node_modules`, used by the `ms-*`/`mf-*` CI samples): "Could not resolve
  node_modules/@angular/common/locales/en.js". `federation.config.mjs.ejs` therefore shares the
  locales with a plain `share({ '@angular/common/locales/<locale>': { requiredVersion: 'auto',
includeSecondaries: false } })` helper so the entry point is inferred by node resolution.
- `login.service.ts.ejs` needs `AuthServerProvider` for oauth2 too (from `auth-session.service`,
  since `authenticationUsesCsrf` covers `oauth2` and `session`); dropping that import broke every
  oauth2/session sample with `TS2304`.

## Angular client — module federation

- Webpack module federation (`webpack/webpack.microfrontend.js.ejs`) shares app-local barrels
  (`app/config`, `app/core/auth`, `app/core/util`, `app/shared/*`, …) with `shareMappings`. A share
  key only matches an import of exactly that specifier, so it only takes effect for directories
  with an `index.ts` barrel. A module that is part of a shared barrel's import graph must never
  import that barrel itself: the provider's `get()` then waits for the "consume" chunk of its own
  key and the app hangs at bootstrap with a blank page and no console error (every Cypress spec of
  a `microfrontend: true` webpack sample fails on `[data-cy="navbar"]`). Example: for oauth2,
  `core/auth/user-route-access.service.ts` used `LoginService` (`app/login/login.service.ts`), which
  imports `app/core/auth` — fixed by redirecting to `oauth2/authorization/oidc` directly in the
  guard. Do **not** fix such cycles by importing concrete files (`app/core/auth/account.service`):
  native federation only publishes the barrel specifier and fails at runtime with
  "Unable to resolve specifier 'app/core/auth/account.service'". Both bundlers must be checked.
- Repro/bisect recipe: generate the sample client-only (`skipServer: true`), `npm run
webapp:build:prod`, serve `build/generated/webapp` with a tiny Node server that answers
  `/api/account` with 401 and `/management/info`, and run a one-test Cypress spec that visits `/`
  and checks the navbar; bisect by trimming the `shareMappings(...)` list. The built `main.*.js`
  shows the cycle: the provider entry for the key lists
  `default-webpack_sharing_consume_default_<key>` among its chunk dependencies.

- Native federation (`@angular-architects/native-federation`, esbuild bundler): when an application exposes
  itself (`exposeMicrofrontend`, the gateway is its own `self` microfrontend and routes/navbar go through
  `loadEntityRoutes('<name>')`/`loadNavbarItems('<name>')`), `initFederation(remotes, { hostRemoteEntry })`
  must set `hostRemoteEntry.name` to the module federation name. Without it the orchestrator registers the host
  as `__NF-HOST__` and `loadRemoteModule('gateway', …)` throws `NFError: Remote 'gateway' is not initialized`;
  the router then retries the lazy route endlessly, the tab freezes, Cypress prints nothing and the CI
  "E2E: Run" step times out after 15 minutes (locally the Electron renderer crashes after ~4 min).
- Repro without Docker: download the `app-<sample>` CI artifact (it contains the generated apps), `npm install`
  at the workspace root, `npm run webapp:build:prod` in `gateway` and `blog`, serve `gateway/target/classes/static`
  at `/` and `blog/target/classes/static` under `/services/blog/*` with a tiny Node stub answering
  `/api/authenticate`, `/api/account`, `/management/info`, `/services/blog/api/*`, then run the blog
  `entity/blog.cy.ts` spec from `blog/` (baseUrl `http://localhost:8080/`) with a watchdog; Playwright WebKit
  with console capture shows the underlying `[NF]` errors. macOS has no `timeout`: use a background job + kill.

- Native federation translations: the esbuild `translatePartialLoader` only loads the application's own
  `loadLocale(lang)`. Remote dictionaries are merged after login by
  `app/core/microfrontend/microfrontend-translation.service.ts` (`loadTranslation(remote, lang)` from the
  remote's exposed `./i18n`, then `translateService.setTranslation(lang, translations, true)`); the navbar's
  account effect calls `load(currentLang)` and waits for it before setting the remote navbar items, and the
  service re-merges on `onLangChange` once enabled. Anonymous users therefore never fetch remote i18n chunks.
  The webpack bundler still lists every remote in `provideTranslateHttpLoader` resources at startup.

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

- `@content` is used only by the rsbuild bundler variant: `global.scss.ejs` and `jhi-navbar.vue.ejs` emit
  `url("<%- clientBundlerRsbuild ? '@' : '/' %>content/images/…")`, so a grep for `'@content/` finds nothing
  while `rsbuild.config.ts` still needs the `@content` alias (Vite uses absolute `/content/…` URLs). Grep for
  every quoting/EJS form before declaring an alias unused.
- With `resolve.tsconfigPaths: true` in `vite.config.ts`, tsconfig `paths` only reach Vite's own resolver. The
  `@module-federation/vite` plugin resolves `shared` keys itself, so application modules shared by key
  (`@/shared/jhipster/constants`, …) fail with "Rolldown failed to resolve import … from virtual:mf:…loadShare…"
  unless `shareMappings` adds `import: './src/main/webapp/app/…'` (as the React template does). Reproduce with a
  monolith `microfrontend: true, exposeMicrofrontend: true, clientBundler: vite` and `npm run webapp:build:prod`.

## React client

- User-management lives in `…/app/modules/administration/user-management/` (plain templates), not in
  the entity templates. React and Vue set `skipClient: true` on the built-in user entities.
- Update pages must navigate back via a `useEffect` on `updateSuccess` (redux state), never directly
  after dispatching the save: navigating while the PUT is in flight lets follow-up requests (e.g.
  cypress `afterEach` cleanup) race the save on the server.
- Since 9.2.1 React is Vite-only (`generators/react/templates/vite.config.ts.ejs`, needle
  `jhipster-needle-add-vite-config`); `clientBundler: webpack` is dropped from `.yo-rc.json` and
  `devServerPort` is reset to `9000 + applicationIndex` in the react `configuring` phase. Old
  `webpack/*` files are removed by `generators/react/cleanup.ts`. Microfrontends use
  `@module-federation/vite` with `module-federation.config.ts`; the gateway registers remotes via
  `registerRemotes` in `index.tsx` and loads them with `loadRemote`. Translations are bundled by
  `client/generators/i18n/.../index_vite.js` (needs `deepmerge`) for both monoliths and
  microfrontends. To verify: generate a monolith plus a gateway/microservice pair from a JDL,
  `npm install`, then `npm run webapp:build:dev` and `npm test` in each app.
- `@module-federation/vite` only proxies a shared module to the host when it can resolve it: for
  app-local modules (`app/config/store`, …) the `shared` entry needs `import: './src/main/webapp/<key>'`
  (see `shareMappings` in `module-federation.config.ts.ejs`); without it the remote silently uses its
  own copy. Even so, remotes must get host state from React context (`useStore()` from the shared
  `react-redux`, see `entities/routes.tsx.ejs`), never from module singletons like `getStore()`.
  Symptom when this breaks: the remote injects its reducers into its own store and selectors throw
  `Cannot read properties of undefined` for the microservice key.
- Microfrontend translations: each remote registers its own `i18n/<locale>/<locale>.js` into the
  shared `TranslatorContext` from a top-level `await registerTranslations()` in its exposed
  `entities/menu.tsx` and `entities/routes.tsx` (`app/shared/reducers/locale.ts.ejs`). The loader
  must memoize the pending _promise_ per locale, not a "done" flag: the menu and routes modules load
  concurrently, and a flag lets the second caller resolve before the i18n chunk arrives, so the
  page renders `translation-not-found[...]` and never re-renders (react-jhipster's `Translate` is
  a class component that only re-renders with its parent). This only shows up with CI-like latency;
  reproduce it by delaying the remote's `assets/en-*.js` response a few seconds in the stub server.
- Runtime repro without Docker: build gateway + microservices (Gradle output is
  `build/generated/webapp`), serve them with a stub backend mapping `/services/<ms>/*` to the
  microservice static dir, and run a Cypress spec on the gateway (navbar entity items from the
  remote, `/blog/blog`, headings translated).
- The development ribbon (`shared/layout/header/header.scss.ejs`) must stay below react-toastify's
  container (`--toastify-z-index: 9999`): with a higher z-index the translucent ribbon paints over
  the top-left toasts and hides the second line of the message (e.g. the entity id of
  "A Blog is updated with identifier …"). react-toastify 11 renders the message as a bare text node
  inside the flex toast (no `.Toastify__toast-body`), so two-line wrapping at 320px is normal.
- Stub-server details that matter for entity Cypress specs: infinite-scroll lists need a `Link`
  header (`<…>; rel="last",<…>; rel="first"`) or the reducer throws reading `length`; success toasts
  come from `x-<app>app-alert` (translation key) + `x-<app>app-params` (id) response headers.

## Spring Boot server

- `LoggingAspect.java.ejs` is shared by imperative and reactive apps. For reactive apps the around
  advice logs `Mono`/`Flux` on termination (`doOnSuccess`/`doOnComplete`/`doOnError`) and also
  handles synchronous throws itself: an `@AfterThrowing` advice needs
  `ExposeInvocationInterceptor.currentInvocation()`, which is not set when the reactive
  `@Transactional` interceptor invokes the target lazily at subscribe time, so it fails with
  "No MethodInvocation found" and turns a `BadRequestAlertException` into a 500 (visible in
  `*ResourceIT` create/update-with-invalid-id tests). Validate aspect changes by generating a reactive
  app, removing `@Profile(dev)` from `LoggingAspectConfiguration` and raising the package log level
  to DEBUG in `src/test/resources/config/application.yml`, then running one `*ResourceIT`.

## Server-side user caches

- Cache names: `usersByLogin` / `usersByEmail` (constants on `UserRepository`).
- Design rule: the plain finders `findOneByLogin` / `findOneByEmailIgnoreCase` are **uncached** and
  used by uniqueness checks and write flows; caching belongs on the
  `findOneWithAuthoritiesByLogin` / `findOneWithAuthoritiesByEmailIgnoreCase` variants used by read
  and authentication paths. Rationale: a `@Cacheable` lookup racing a concurrent eviction (DELETE
  while an update is in flight) repopulates the cache with a stale user, and later creations fail
  with `login-already-used` / `email-already-used` even though the database row is gone.
- Reactive applications cannot enable a cache provider — the cache generator throws
  (`generators/spring-boot/generators/cache/generator.ts`).

## Testing and samples

- `lib/testing/helpers.ts`: the `jhipster` preset injects `skipChecks`, `reproducibleTests`,
  `skipInstall`, `skipGit`, `useVersionPlaceholders`. `defaultHelpers` adds `skipPrettier` +
  `dryRun`; most specs use it. `withJHipsterGenerators()` wires real generators, mocks via
  `withMockedJHipsterGenerators`.
- Per-test environment lookup is cheap (~10 ms); module import of `cli/environment-builder.ts`
  (~1 s) happens once per mocha worker.
- Sample apps for manual testing: `bin/jhipster.cjs generate-sample <name>` (JIT dev blueprint).
  Workflow samples come from `.blueprint/generate-sample/templates/test-integration/workflow-samples/*.json`;
  daily-build sample names need the `daily-` prefix. Entity sets per database live in
  `.blueprint/generate-sample/support/copy-entity-samples.ts` (`entitiesByType`). The daily builds
  themselves run in `hipster-labs/jhipster-daily-builds`.
  Quirk: `--sample-yorc-folder` copies the sample `.yo-rc.json` into the **current working
  directory**, not the `--project-folder` — run it from the target folder, or stage `.yo-rc.json`
  plus `.jhipster/*.json` manually and run plain `jhipster` there. `CI=true` suppresses prompts.
- Running generated-app Cypress from a VS Code-spawned shell: `unset ELECTRON_RUN_AS_NODE` first,
  otherwise the Cypress Electron binary starts in Node mode and dies with `bad option: --no-sandbox`.

## Debugging CI failures

- Vite dev-server e2e flakiness (`devserver.yml`, Vue): two dev-only effects hit the Cypress login
  tests. (1) A dependency first imported by a lazily loaded module (`deepmerge` from the i18n
  bundle) is discovered at runtime, Vite re-optimizes and reloads the page — fixed with
  `optimizeDeps.entries` covering the app sources. (2) `router.beforeResolve` calls `hideLogin()`;
  in dev mode the initial navigation resolves late (lazy route component loading), after Cypress
  opened the login modal, so the modal is closed under the test (`[data-cy="username"]` never
  found, retries pass once modules are cached) — fixed by skipping `hideLogin()` when
  `from === START_LOCATION`. Debug recipe: download the run's `screenshots-*` artifact
  (`gh run download <id> -R jhipster/generator-jhipster`) and check the order of the app init
  requests (`/management/info`, `/api/account`) versus the test clicks in the Cypress log; delay
  the route import in a generated sample (`() => new Promise(r => setTimeout(r, 3000)).then(() =>
import(...))`) to reproduce init races locally.
- Daily builds and PR app jobs surface generated-app compile errors; reproduce locally by generating
  the failing sample (see above) and running its own `npm run webapp:build:dev` / `./gradlew` —
  faster and more precise than reading CI logs.
- `check-angular` (and siblings) are aggregator jobs over the app matrix — the real error is in an
  application job's log.
- When a regression window is known, `git log upstream/main --since=… --until=…` plus generating the
  sample at both ends of the window and diffing the outputs pinpoints the offending commit quickly.
