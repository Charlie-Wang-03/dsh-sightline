# Packaging and public distribution

Sightline v0.1 follows the DeepSeek Harness bundle contract verified against `dsh@0.1.1-rc.2` / upstream `b150a551`.

## Package surfaces

The package declares two DSH faces:

- `dsh.bundle.patch = ./cordis.patch.yml` — installs the Host plugin row into a profile;
- `dsh.client.platform = web` — exposes `./client` as the browser module for the same enabled package.

The bundle patch inserts the package root as `dsh-sightline`. The root exports ordinary Cordis `name`, `inject`, and `apply` fields, while `./client` registers a keyed `tool.call.toolview` for the `sightline` wire tool.

The Web view consumes the tool result's replayable `presentationMeta`. Sightline sets that metadata to the same canonical `SightlineReport` returned as the tool value, so the visual panel does not parse the model-facing Markdown or run a second comparison path.

## Primary public installation path

The intended v0.1 public distribution channel is a **prebuilt npm package**:

```sh
dsh plugin --profile web add dsh-sightline@0.1.0
```

This avoids asking normal users to approve Sightline's own build script at install time. The npm package must contain already-built Host artifacts, the browser client bundle, the DSH bundle patch, README, packaging notes, and MIT license.

The package name and first npm publication remain release gates until they are verified against the live npm registry and the maintainer account.

## Local validation

Install dependencies, build, and test the source checkout:

```sh
pnpm install
pnpm run check
```

Create the exact distributable tarball:

```sh
pnpm pack
```

Inspect the tarball before publication. The intended package surface is deliberately small:

```text
package.json
LICENSE
README.md
client.js
cordis.patch.yml
docs/PACKAGING.md
dist/src/**
```

`tests/`, development documentation, repository workflows, and local artifacts are not runtime package requirements.

## Install a packed artifact into an isolated profile

For a locally built tarball:

```sh
dsh plugin --profile sightline add ./dsh-sightline-0.1.0.tgz
dsh --profile sightline --dump-config
```

The resulting profile should list `dsh-sightline` after the base bundle and the dumped configuration should contain the `sightline` plugin row.

Repository CI performs the same conceptual flow in an isolated `DSH_HOME`, then resolves both `dsh-sightline` and `dsh-sightline/client` from the installed profile. Development-checkout imports are not accepted as a substitute for this clean-profile gate.

## Git installs and build permission

The package retains a `prepare` build for source/git installs because the current DSH plugin documentation requires TypeScript git dependencies to build after checkout.

pnpm 10+ may require the user to explicitly allow a git dependency's build script before installation can run it. That permission executes package code on the user's machine and must not be treated as routine or hidden.

For that reason, direct GitHub installation is a development/fallback path, not the primary v0.1 onboarding path. Users who intentionally install from Git should inspect and pin the exact source revision they trust.

## npm release policy

Public npm publication must satisfy all of the following:

1. `package.json` contains public repository metadata, `license: MIT`, and `publishConfig.access: public`.
2. The committed dependency lockfile is current and CI uses a frozen install.
3. `pnpm run check` passes from the release commit.
4. `pnpm pack` produces the expected prebuilt artifact and no sensitive/unnecessary files.
5. Clean-profile installation succeeds from that packed artifact.
6. The release commit has passed the repository's security/history/privacy gates.
7. The npm package name and maintainer publishing authority are verified immediately before first publication.

Trusted publishing with npm provenance is preferred once the npm package and publisher relationship are configured. Do not add a long-lived npm token to repository files.

No npm publication is implied merely by merging release-readiness changes.
