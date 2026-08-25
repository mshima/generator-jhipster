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

## Angular client

- Microfrontends use esbuild + `@angular-architects/native-federation` (`clientBundler: esbuild`,
  webpack module federation only remains for `clientBundler: webpack`). Pieces:
  `federation.config.mjs` (shares npm deps via `shareAll`, Angular locales via
  `shareAngularLocales`, app singletons via `sharedMappings`), `tsconfig.federation.json` (exposed
  entries), and `build-plugins` as a local builder package (`./build-plugins:native-federation`)
  wrapping `runBuilder` to inject the esbuild plugins — native federation runs Angular's
  application builder itself, so `@angular-builders/custom-esbuild` plugins would be bypassed.
  `es-module-shims` must be in the `polyfills` list and in `dependencies`; the gateway needs
  `entryPoints` set because it exposes nothing (NF's fallback is `src/main.ts`).
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
- `@module-federation/vite` cannot share app-local modules (`app/config/store`, …): it only
  proxies a shared module to the host when it can detect named exports from an installed npm
  package, otherwise the generated `__loadShare__` module always uses the remote's own copy (and
  Vite's `resolve.alias` runs before any plugin anyway, so `app/*` share keys never match). Do not
  add `app/*` entries to `shared`; only npm dependencies are shared. Remotes must get host state
  from React context (`useStore()` from the shared `react-redux`, see `entities/routes.tsx.ejs`),
  never from module singletons like `getStore()`. Symptom when this breaks: the remote injects its
  reducers into its own store and selectors throw `Cannot read properties of undefined` for the
  microservice key. Vue has the same constraint but is unaffected because it passes services via
  `provide`/`inject`.
- Runtime repro without Docker: build gateway + microservice, run a tiny Node server that serves
  the gateway `target/classes/static`, maps `/services/<ms>/*` to the microservice static dir and
  stubs `/api/authenticate`, `/api/account`, `/management/info` and the entity API, then run a
  Cypress spec in the gateway (`cy.login`, open the entity menu, visit the remote entity page).

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
