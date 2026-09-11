# Security policy

## Reporting a vulnerability

Please do not open a public issue for a potential security problem. Report it privately through
[the security advisory form](https://github.com/jhipster/generator-jhipster/security/advisories/new), and we will work with you on a fix and a
coordinated disclosure.

## The trust model of `.yo-rc.json`

`.yo-rc.json` is **not inert configuration data — it is generator input, and almost every one of its properties can become part of the
generated application**: Java or TypeScript sources, build-script content, file and directory names, dependency coordinates, or the name of an
npm package that JHipster installs and executes on your machine.

The practical consequence is:

> **Running `jhipster` in a project you did not author is equivalent to running that project author's code on your machine, with your user's
> privileges.**

The same applies to every other file the generator reads as configuration: `.jhipster/*.json` entity files, `.yo-resolve`, JDL files, and any
blueprint referenced from them.

### Why the configuration is trust-sensitive

**Blueprints are executable code.** The `blueprints` and `generators` entries name npm packages. During generation those packages are
resolved, possibly installed, and then **executed** in the generation process — before a single generated file has been reviewed. Their npm
lifecycle scripts (`preinstall`, `install`, `postinstall`) run as well. This is the highest-impact property of the file, and validating the
other properties does not compensate for it.

**Free-text values are embedded in generated files.** Values such as `baseName`, `packageName`, `jhipsterVersion`, `clientPackageManager`,
entity and field names, or validation patterns are interpolated into templates that produce Java sources, `pom.xml` / `build.gradle`,
`package.json`, `Dockerfile`s, shell scripts and CI pipeline definitions. A value that is harmless inside the generator process may be harmful
in the artifact it produces — for example a string that closes a build-file element and appends a plugin, or that terminates a line in a
generated shell script and appends a command. That code does not run during generation; it runs the first time the developer builds, tests or
starts the generated project, which is exactly what happens next.

**Path-like values can write outside the project.** Anything that participates in a file path — custom folders, entity file names, `--dest`,
and any value a blueprint passes to `destinationPath()` — can contain `..` segments or an absolute path. Targets such as `~/.zshrc`,
`~/.ssh/authorized_keys`, `~/.gitconfig` or `.git/hooks/*` turn a file write into code execution; a git hook needs no build step at all, it
runs on the next commit or checkout.

**URLs and coordinates redirect the supply chain.** Registry URLs, repository URLs, service discovery endpoints and dependency versions coming
from the configuration decide where the generated project fetches artifacts from and what it fetches. A modified value can point the generated
build at an attacker-controlled registry, or pin a dependency to a malicious version, without touching a line of application code.

### What this means in practice

| Scenario                                                                              | Trust required                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| You wrote the `.yo-rc.json` yourself                                                  | Normal use, no additional risk.                                                                               |
| You cloned a repository from a source you already trust                               | Normal use — the same trust you already grant its build scripts.                                              |
| You cloned a public repository to try it, reproduce a bug report or review a proposal | **Untrusted.** Do not run the generator, `npm install` or the build outside a sandbox.                        |
| A pull request modifies `.yo-rc.json`, `.jhipster/*.json` or a JDL file               | **Review it as carefully as source code.** Adding a blueprint is a code-execution change, and it is one line. |

JHipster cannot tell these cases apart on its own — only the person running the command can.

This trust model is not specific to JHipster: a directory containing a `package.json` can already execute code through npm lifecycle scripts,
and the same holds for Maven and Gradle builds. `.yo-rc.json` belongs to that same family of files and deserves the same suspicion.

### Recommendations for users

- **Do not run the generator in a repository you would not be willing to build.** If you would hesitate to run `./mvnw` or `npm install`
  there, hesitate to run `jhipster`.
- **Read `.yo-rc.json` before the first run**, especially the `blueprints` and `generators` entries, and look up any blueprint you do not
  recognize.
- **Review configuration files in pull requests** with the same scrutiny as source code.
- **Use a sandbox for untrusted projects**: a container, a disposable VM, or a user account without access to your SSH keys, cloud credentials
  and shell profiles.
- **Do not run the generator as root**, and do not run it from your home directory.

### Recommendations for CI and hosted generation

- Run generation in an ephemeral, network-restricted container, and treat the checkout as untrusted input: never generate into a directory
  shared with credentials, caches or other jobs.
- Keep generation non-interactive **and** restricted. When no human can answer a trust prompt, the safe default is untrusted, not "assume
  yes".
- Where the configuration is assembled from user input — a hosted generation service, for instance — accept only a fixed allow-list of options
  and values. Never forward arbitrary configuration objects, path-like values or blueprint names to the generator.

### What the generator does on its side

<!-- Keep this section in sync with what actually ships: the boundaries below are part of the hardening work and must not be
documented before they are implemented. -->

These are hardening measures, not a replacement for the trust decision described above:

- File writes are constrained to descendants of the destination root, so a configured path cannot escape the project directory.
- Generation in a directory that is not on the trusted-paths list asks for explicit confirmation before the configuration is applied;
  non-interactive runs default to the restricted behaviour.
- Values interpolated into structured outputs are escaped for their target format.

None of this makes an untrusted `.yo-rc.json` safe to run, because blueprints are by design executable extensions. The trust decision is the
actual security boundary.

If you find a way to escape these boundaries — a write outside the destination root, a configuration value that produces executable content in
a generated file, or a bypass of the trust confirmation — please report it privately as described above.
