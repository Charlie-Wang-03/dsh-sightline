# v0.1 Product Contract

## 1. Problem

Modern coding agents do not necessarily discover or prioritize workspace instructions in the same way. A repository may contain `AGENTS.md`, `CLAUDE.md`, local overlays, rule directories, and user-global instruction files. The same `cwd` can therefore produce materially different effective guidance depending on the agent.

This difference is easy to miss because users usually inspect files one tool at a time. Sightline makes the cross-agent difference explicit.

## 2. Target user

The primary v0.1 user is a developer who uses DeepSeek Harness alongside Codex and/or Claude Code and wants to answer:

> For this repository and working directory, which instruction sources are effective for each agent, and where do those views diverge?

## 3. Job to be done

Given a repository and `cwd`, produce one compact, inspectable comparison that lets the user:

- see which instruction sources contribute to each agent view;
- distinguish runtime-observed evidence from rule-based prediction;
- identify files or scopes visible to one agent but not another;
- understand precedence/order differences without reading three independent documentation sets.

## 4. Supported agents and evidence contract

### DeepSeek Harness

Preferred evidence: **observed**.

Sightline consumes public DSH session/runtime provenance representing instruction sources materialized for the live session. If authoritative evidence is unavailable for the current session, the DSH column is marked `unavailable`; v0.1 does not silently substitute a static prediction and label it observed.

### Codex

Evidence: **predicted**.

Resolve the effective instruction surface from local files and documented Codex discovery/precedence rules. The resolver exposes a compatibility/version identity describing the semantics it implements.

### Claude Code

Evidence: **predicted**.

Resolve the effective instruction surface from local files and documented Claude Code memory/rules semantics. The resolver exposes a compatibility/version identity.

## 5. v0.1 capabilities

### Discover

Inventory only instruction sources relevant to the three supported adapters. Discovery is bounded to documented locations/scopes and does not become a general full-disk crawler.

### Resolve

Each adapter produces an ordered `EffectiveInstructionSurface` with:

- agent identity;
- evidence kind (`observed`, `predicted`, or `unavailable`);
- target `cwd`;
- resolver/compatibility identity;
- ordered instruction sources;
- explicit diagnostics for unsupported or ambiguous cases.

### Compare

Produce deterministic structural divergence. At minimum, identify:

- source present for all supported views;
- source present for only a subset;
- order/precedence differences when they are observable in the normalized model;
- unknown/unavailable states without treating them as absence.

No semantic judgment of instruction prose is required.

### Visualize

Expose the comparison in two forms:

1. a structured machine-readable report suitable for the DSH tool/runtime surface;
2. a compact DSH-native visual panel that answers the main question quickly.

The panel prioritizes the matrix of sources versus agents, with explicit `Observed` / `Predicted` / `Unavailable` labels.

## 6. v0.1 non-goals

The first release does **not**:

- score instruction quality;
- use an LLM to find contradictions;
- recommend prompt wording;
- estimate or optimize token usage;
- synchronize or generate `AGENTS.md`, `CLAUDE.md`, or rule files;
- modify workspace instructions;
- provide a CI drift gate;
- support Cursor, Gemini CLI, Copilot, OpenCode, or other agents;
- claim to prove that a model followed an instruction;
- claim Codex/Claude runtime observation without an authoritative runtime seam.

These exclusions are product boundaries, not a backlog.

## 7. Safety and privacy contract

Core operation is local-first and read-only.

- Sightline itself does not require or call a Sightline-owned network service to produce a report.
- Sightline does not modify instruction files.
- Hosted repository discovery uses the public DSH `ctx.fs` capability.
- Files outside the documented discovery roots are not read merely because they are nearby.
- Errors and unsupported cases fail explicitly rather than triggering broad fallback scanning.

The DSH host has two different presentation boundaries:

1. **Canonical report / Web UI metadata.** The full `SightlineReport` contains the resolved `repositoryRoot`, `cwd`, source identities, evidence states, diagnostics, and optional digests/provenance. It is stored as DSH tool result metadata so the dedicated Web ToolView can render and replay the exact report without recomputing it.
2. **Model-facing projection.** DSH converts the tool value into text through Sightline's renderer. That projection is handled by the model/provider configured for the current DSH session like other tool output. Sightline does not make an additional network request for it.

For v0.1, the model-facing projection is intentionally narrower than the canonical report: it contains the source comparison, evidence labels, presence states, and diagnostic codes, while omitting absolute `repositoryRoot` / `cwd` values and diagnostic messages that may contain host-path details.

Sightline does not transmit instruction file bodies to a Sightline-owned service. Users remain responsible for the privacy properties of the DSH provider/model they configure and for the normal DSH handling of tool results and session data.

## 8. Determinism contract

For identical filesystem inputs, adapter configuration, compatibility rules, target `cwd`, and DSH evidence, the normalized report is deterministic.

Do not include wall-clock timestamps or random identifiers in the semantic comparison result. Presentation layers may attach ephemeral UI metadata outside the canonical report.

## 9. v0.1 acceptance criteria

v0.1 is complete only when all of the following are demonstrated:

1. A fixture repository with nested `AGENTS.md` / `CLAUDE.md` / Claude rule sources yields intentionally different DSH, Codex, and Claude views.
2. Codex and Claude resolver behavior is covered by deterministic fixture tests for discovery and precedence.
3. A real DSH integration test proves the DSH column is derived from runtime/session provenance, not a reimplementation silently labelled as observed.
4. `unavailable` is preserved as a first-class state in the comparison engine and UI.
5. The same canonical report powers both the machine-readable surface and the visual panel.
6. The plugin can be installed into a clean DSH profile through the supported bundle mechanism.
7. The core path requires no Sightline API key and no Sightline-owned network service.
8. The model-facing projection does not expose absolute workspace paths or full diagnostic messages by default.

## 10. Demo contract

The release demo uses one small repository where the three columns visibly diverge.

The desired first impression is:

```text
Same repo. Different agents. Different rules.

                    DSH        Codex       Claude
                  Observed    Predicted    Predicted
AGENTS.md             ●           ●
CLAUDE.md              ●                       ●
packages/api/AGENTS.md ●           ●
.claude/rules/always.md                         ●
```

The demo must make evidence labels visible so `Observed` and `Predicted` cannot be confused.

## 11. Compatibility baseline

v0.1 architecture and implementation are verified against DeepSeek Harness `0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

Because DSH is a developer preview, every implementation phase that binds to a DSH service, event, client slot, or bundle contract must re-check current upstream authority before changing that seam or broadening compatibility claims.
