<p align="right">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

# Sightline

**Same repo. Different agents. Different rules.**

See which workspace instruction sources DeepSeek Harness actually loaded — and which Codex and Claude Code would load — for the same repository and working directory.

> **Status: v0.1.0.** The first public release is available on npm and GitHub Releases. Core comparison, DSH runtime observation, Codex/Claude prediction, installable DSH bundle packaging, clean-profile validation, and the dedicated DSH Web ToolView are implemented and tested.

## Why Sightline

A repository can contain `AGENTS.md`, `CLAUDE.md`, nested instructions, user-global instructions, and Claude rules at the same time. DeepSeek Harness, Codex, and Claude Code do not discover those sources identically.

That means one workspace can silently present different instruction surfaces to different coding agents.

Sightline turns that hidden difference into one compact comparison.

## What you see

```text
Same repo. Different agents. Different rules.

                    DSH        Codex       Claude
                  Observed    Predicted    Predicted
AGENTS.md             ●           ●
CLAUDE.md              ●                       ●
packages/api/AGENTS.md ●           ●
.claude/rules/always.md                         ●
```

The Web ToolView renders the same canonical report with explicit evidence badges and `Present` / `Absent` / `Unknown` states.

| Agent | v0.1 evidence |
| --- | --- |
| DeepSeek Harness | **Observed** from the live DSH Session's durable typed instruction provenance when available |
| Codex | **Predicted** from documented discovery rules and local files |
| Claude Code | **Predicted** from documented memory/rules semantics and local files |

Sightline never presents a prediction as observed runtime fact.

## Install

The primary public v0.1 installation path is the prebuilt npm package:

```sh
dsh plugin --profile web add dsh-sightline@0.1.0
```

The package is published on npm as `dsh-sightline@0.1.0`. For development from this repository, see [`docs/PACKAGING.md`](docs/PACKAGING.md).

## Use

Start the DSH Web profile after installation:

```sh
dsh web
```

In a DSH session rooted in a Git repository, ask the agent to use the `sightline` tool, for example:

```text
Use sightline and tell me where the DSH, Codex, and Claude instruction views diverge.
```

Sightline resolves all three views against the same live Session `cwd` and repository root.

## What v0.1 does

1. **Discover** relevant instruction sources.
2. **Resolve** one effective surface per supported agent.
3. **Compare** the surfaces with deterministic structural rules.
4. **Visualize** agreement, divergence, and unknown states in DSH.

The first release intentionally does **not** lint instruction quality, rewrite files, synchronize agents, infer semantic contradictions with an LLM, optimize token use, or claim that a model followed an instruction.

## Architecture

```text
live DSH tool call + workspace
            |
            +---- exec.agent.session ----> DSH adapter ------ Observed ----+
            |                                                              |
            +---- ctx.fs ---------------> Codex adapter ---- Predicted ----+--> canonical report
            |                                                              |
            +---- ctx.fs ---------------> Claude adapter --- Predicted ----+
                                                                           |
                                                                           +--> model-facing projection
                                                                           +--> DSH Web ToolView
```

Agent-specific discovery semantics stay behind adapters. The comparison layer is pure and agent-agnostic. Hosted filesystem discovery uses the public DSH `ctx.fs` capability; standalone resolver use defaults to a minimal read-only Node filesystem adapter.

## Privacy and trust boundary

Sightline is local-first and read-only, but "local-first" does not mean that every DSH tool result stays on the machine.

- Sightline itself makes no additional network request to a Sightline-owned service.
- Sightline does not modify instruction files.
- The full canonical report is retained as DSH tool metadata for the Web ToolView and replay; it includes workspace identity such as `repositoryRoot` / `cwd`, and the ToolView may display the absolute session `cwd` and full diagnostic messages. Anyone who can view that DSH Web session can see those details, subject to DSH Web access controls.
- The **model-facing projection** is narrower: it contains source identities, evidence labels, presence states, and diagnostic codes while omitting absolute workspace paths and full diagnostic messages by default.
- That model-facing projection is handled by the model/provider configured for the current DSH session like other DSH tool output.
- Sightline does not send instruction file bodies to a Sightline-owned service.

See [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) and [`SECURITY.md`](SECURITY.md) for the complete boundary.

## Compatibility

v0.1 is verified against:

- DeepSeek Harness `0.1.1-rc.2`;
- upstream DSH commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`;
- Node `^22.19.0 || >=24.0.0`;
- pnpm `11.7.0`.

DSH is a developer preview. Sightline therefore makes a tested-version claim rather than promising broad compatibility with unverified DSH releases.

Codex and Claude Code adapters similarly carry explicit compatibility identities. Claude path-scoped rules are detected but conservatively deferred when `cwd` alone is insufficient to prove that the rule is active.

See [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md).

## Verification

Current automated coverage includes:

- package/bundle/client surface tests;
- Codex global, project, nested, override, fallback, and budget behavior;
- Claude user/project memory and always-loaded rule behavior;
- fail-closed handling of path-scoped Claude rules;
- DSH durable provenance folding and incompatible-source handling;
- real DSH `ToolRuntime + SessionStore + dsh-fs-local` host integration;
- canonical three-column report generation;
- clean-profile packed-artifact installation and export resolution;
- browser ToolView registration/render smoke tests;
- Windows/POSIX path normalization.

Run the local gate with:

```sh
pnpm run check
```

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) | v0.1 product, evidence, privacy, and non-goal contract |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | system boundaries and data model |
| [`docs/DSH_RUNTIME_SEAM.md`](docs/DSH_RUNTIME_SEAM.md) | authoritative DSH provenance seam |
| [`docs/DSH_HOST_TOOL.md`](docs/DSH_HOST_TOOL.md) | live-session ownership and filesystem binding |
| [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) | resolver/runtime compatibility identities |
| [`docs/PACKAGING.md`](docs/PACKAGING.md) | npm/bundle packaging and clean-profile validation |
| [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) | public v0.1 release gates |

## Contributing

Issues and focused pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) before making non-trivial changes.

Security-sensitive reports should follow [`SECURITY.md`](SECURITY.md).

## License

MIT. See [`LICENSE`](LICENSE).

## Project relationship

Sightline is an independent community project for the DeepSeek Harness ecosystem. It is not an official DeepSeek product and is not endorsed by DeepSeek unless explicitly stated by DeepSeek.
