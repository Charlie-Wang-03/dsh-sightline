# dsh-sightline

**Same repo. Different agents. Different rules.**

See the same workspace through the instruction-discovery semantics of DeepSeek Harness, Codex, and Claude Code.

> Status: v0.1 contract and architecture scaffold. No public release yet.

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
- [`AGENTS.md`](AGENTS.md) — repository rules for AI coding agents and contributors.

## Compatibility baseline

The initial design baseline is DeepSeek Harness `0.1.1-rc.2` at commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`. DSH is a developer preview, so implementation work must re-verify public seams before relying on them.
