# Packaging and clean-profile validation

Sightline v0.1 follows the DeepSeek Harness bundle contract verified against `dsh@0.1.1-rc.2` / upstream `b150a551`.

## Package surfaces

The package declares two DSH faces:

- `dsh.bundle.patch = ./cordis.patch.yml` — installs the Host plugin row into a profile;
- `dsh.client.platform = web` — exposes `./client` as the browser module for the same enabled package.

The bundle patch inserts the package root as `dsh-sightline`. The root exports ordinary Cordis `name`, `inject`, and `apply` fields, while `./client` registers a keyed `tool.call.toolview` for the `sightline` wire tool.

The Web view consumes the tool result's replayable `presentationMeta`. Sightline sets that metadata to the same canonical `SightlineReport` returned as the tool value, so the visual panel does not parse the model-facing Markdown or run a second comparison path.

## Local package validation

Build and test the source checkout:

```sh
pnpm install --no-frozen-lockfile
pnpm run check
```

Create a prebuilt tarball:

```sh
pnpm pack
```

The tarball contains the compiled Host entry under `dist/src`, the browser `client.js`, and `cordis.patch.yml`.

## Install into an isolated DSH profile

For a locally built tarball:

```sh
dsh plugin --profile sightline add ./dsh-sightline-0.1.0.tgz
dsh --profile sightline --dump-config
```

The resulting profile should list `dsh-sightline` after the base bundle and the dumped configuration should contain the `sightline` plugin row.

The repository CI performs this flow in a temporary `DSH_HOME`, then resolves both `dsh-sightline` and `dsh-sightline/client` from the installed profile. This is the clean-profile acceptance gate; development checkout imports are not accepted as a substitute.

## Git installs and build permission

The package also provides a `prepare` build for source/git installs, as required by the current DSH plugin documentation. pnpm 10+ may require the user to explicitly allow a git dependency's build script before installation can run it. That permission executes package code on the user's machine and must not be treated as routine or hidden.

For the current private v0.1 validation, the prebuilt tarball path is preferred because it tests the exact distributable artifact without granting Sightline a git-install build allowance.

No npm publication or public release is implied by this document.
