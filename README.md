# dsh-sightline

**Same repo. Different agents. Different rules.**

See the same workspace through the instruction-discovery semantics of DeepSeek Harness, Codex, and Claude Code.

> Status: private v0.1 implementation. Core comparison, Codex/Claude prediction, and the DSH observed-provenance adapter are tested; installable bundle and UI work remain.

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
- Pure cross-agent comparison: preserves `present`, `absent`, and `unknown` as distinct states.
- GitHub Actions baseline: typecheck, build, resolver tests, and focused DSH provenance integration tests.

## Architecture

```text
workspace + DSH session evidence
            |
            v
     agent adapters
  +---------+---------+
  |         |         |
 DSH      Codex     Claude
observed predicted  predicted
  +---------+---------+
            |
            v
   normalized surfaces
            |
            v
     comparison engine
            |
            v
 structured report + compact DSH UI
```

The core comparison layer is pure and agent-agnostic. Agent-specific discovery semantics live behind adapters so they can be versioned, tested, and updated independently.

## Read first

- [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) — what v0.1 must and must not do.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system boundaries, data model, and implementation plan.
- [`docs/DSH_RUNTIME_SEAM.md`](docs/DSH_RUNTIME_SEAM.md) — the public DSH provenance seam and fail-closed observation contract.
- [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) — resolver/runtime compatibility identities and limitations.
- [`AGENTS.md`](AGENTS.md) — repository rules for AI coding agents and contributors.

## Compatibility baseline

The current DSH observed integration baseline is DeepSeek Harness `0.1.1-rc.2` at commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`. DSH is a developer preview, so every later bundle/host/client integration step must re-verify the public seams it binds to.
