# dsh-sightline

**Same repo. Different agents. Different rules.**

See the same workspace through the instruction-discovery semantics of DeepSeek Harness, Codex, and Claude Code.

> Status: private v0.1 implementation. Core comparison, Codex/Claude prediction, DSH observed provenance, and the first DSH `sightline` tool are tested. Bundle packaging and the dedicated DSH client view are now implemented on the v0.1 productization branch and remain subject to clean-profile CI validation before they are claimed complete.

## Product promise

Given one repository and one working directory, Sightline shows the effective instruction surface for each supported agent and makes cross-agent divergence explicit.

The v0.1 truth model is deliberately asymmetric:

| Agent | v0.1 evidence |
| --- | --- |
| DeepSeek Harness | **Observed** from DSH session/runtime provenance when available |
| Codex | **Predicted** from documented discovery rules and local files |
| Claude Code | **Predicted** from documented discovery rules and local files |

Sightline must never present a prediction as observed runtime fact.

## v0.1 scope

Sightline does four things:

1. **Discover** relevant instruction sources.
2. **Resolve** each supported agent's effective instruction surface.
3. **Compare** the surfaces using deterministic, non-semantic rules.
4. **Visualize** where the surfaces agree, diverge, or cannot be established.

The first release is intentionally not an instruction linter, synchronizer, editor, token optimizer, or semantic conflict detector.

## Current implementation

- Codex predicted adapter: global/project/nested discovery, override preference, configurable fallback names, and project instruction budget.
- Claude Code predicted adapter: user/project `CLAUDE.md` layering and always-loaded rules; path-scoped rules are conservatively deferred rather than guessed.
- DSH observed adapter: folds durable typed `agent-instructions` provenance from the current public Session surface and fails closed when authoritative evidence is unavailable.
- DSH host tool: argument-free `sightline` tool binds observed evidence to `exec.agent.session`, resolves the same `cwd` for all three agents, and runs all host-side static filesystem discovery through the mounted DSH `ctx.fs` capability.
- Standalone core: Codex/Claude resolvers remain usable outside DSH through the default read-only Node filesystem adapter.
- Pure cross-agent comparison: preserves `present`, `absent`, and `unknown` as distinct states.
- GitHub Actions baseline: typecheck, build, resolver tests, DSH provenance integration, real ToolRuntime + SessionStore + `dsh-fs-local` host integration, and the first divergent three-column report fixture.

### First three-column shape

```text
                    DSH        Codex       Claude
                  Observed    Predicted    Predicted
AGENTS.md             ●           ●
CLAUDE.md              ●                       ●
packages/api/AGENTS.md ●           ●
.claude/rules/always.md                         ●
```

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
                                                                           +--> tool JSON value
                                                                           +--> compact matrix
```

The core comparison layer is pure and agent-agnostic. Agent-specific discovery semantics live behind adapters so they can be versioned, tested, and updated independently. The core filesystem boundary is a minimal read-only capability: standalone consumers default to Node, while the DSH plugin injects the public Harness filesystem seam.

## Read first

- [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) — what v0.1 must and must not do.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system boundaries, data model, and implementation plan.
- [`docs/DSH_RUNTIME_SEAM.md`](docs/DSH_RUNTIME_SEAM.md) — the public DSH provenance seam and fail-closed observation contract.
- [`docs/DSH_HOST_TOOL.md`](docs/DSH_HOST_TOOL.md) — tool ownership, filesystem capability binding, workspace binding, and the first real three-column report.
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — bundle manifest, client export, and clean-profile validation path.
- [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) — resolver/runtime compatibility identities and limitations.
- [`AGENTS.md`](AGENTS.md) — repository rules for AI coding agents and contributors.

## Compatibility baseline

The current DSH observed and host/tool integration baseline is DeepSeek Harness `0.1.1-rc.2` at commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`, rechecked on 2026-08-24. DSH is a developer preview, so every later bundle/client integration step must re-verify the public seams it binds to.
