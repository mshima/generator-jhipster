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

- Daily builds and PR app jobs surface generated-app compile errors; reproduce locally by generating
  the failing sample (see above) and running its own `npm run webapp:build:dev` / `./gradlew` —
  faster and more precise than reading CI logs.
- `check-angular` (and siblings) are aggregator jobs over the app matrix — the real error is in an
  application job's log.
- When a regression window is known, `git log upstream/main --since=… --until=…` plus generating the
  sample at both ends of the window and diffing the outputs pinpoints the offending commit quickly.
