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

Sightline should consume a public DSH session/runtime provenance seam that represents instruction sources actually materialized for the session. If authoritative evidence is unavailable for the current session, the DSH column must be marked `unavailable`; v0.1 must not silently substitute a static prediction and label it observed.

### Codex

Evidence: **predicted**.

Resolve the effective instruction surface from local files and documented Codex discovery/precedence rules. The resolver must expose a compatibility/version note so users can see which documented semantics were implemented.

### Claude Code

Evidence: **predicted**.

Resolve the effective instruction surface from local files and documented Claude Code memory/rules semantics. The resolver must expose a compatibility/version note.

## 5. v0.1 capabilities

### Discover

Inventory only instruction sources relevant to the three supported adapters. Discovery must be bounded to documented locations/scopes and must not become a general full-disk crawler.

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

1. a structured machine-readable report suitable for a DSH tool/API surface;
2. a compact DSH-native visual panel that can answer the main question in roughly ten seconds.

The panel should prioritize the matrix of sources versus agents, with clear `Observed` / `Predicted` labels.

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

Core operation must be local-first and read-only.

- No network call is required to produce a report.
- No instruction file is modified.
- Do not transmit instruction text, paths, digests, or session evidence to an external service.
- The default UI should show source identity and scope; full instruction bodies are not required for the primary comparison view.
- Files outside the documented discovery roots must not be read merely because they are nearby.
- Errors and unsupported cases should fail explicit rather than trigger broad fallback scanning.

## 8. Determinism contract

For identical filesystem inputs, adapter configuration, compatibility rules, target `cwd`, and DSH evidence, the normalized report must be deterministic.

Do not include wall-clock timestamps or random identifiers in the semantic comparison result. Presentation layers may attach ephemeral UI metadata outside the canonical report.

## 9. v0.1 acceptance criteria

v0.1 is complete only when all of the following are demonstrated:

1. A fixture repository with nested `AGENTS.md` / `CLAUDE.md` / Claude rule sources yields intentionally different DSH, Codex, and Claude views.
2. Codex and Claude resolver behavior is covered by deterministic fixture tests for discovery and precedence.
3. A real DSH integration test proves the DSH column is derived from runtime/session provenance, not a reimplementation silently labelled as observed.
4. `unavailable` is preserved as a first-class state in the comparison engine and UI.
5. The same canonical report powers both the machine-readable surface and the visual panel.
6. The plugin can be installed into a clean DSH profile through the supported bundle mechanism.
7. The core path requires no API key and no network access.

## 10. Demo contract

The release demo should use one small repository where the three columns visibly diverge.

The desired first impression is:

```text
Same repo. Different agents. Different rules.

                    DSH        Codex       Claude
root/AGENTS.md       ●           ●
root/CLAUDE.md       ●                       ●
pkg/AGENTS.md        ●           ●
.claude/rules/api                            ●
```

The demo must make evidence labels visible so `Observed` and `Predicted` cannot be confused.

## 11. Compatibility baseline

Initial architecture work is based on DeepSeek Harness `0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` as verified on 2026-08-23.

Because DSH is a developer preview, every implementation phase that binds to a DSH service, event, client slot, or bundle contract must re-check current upstream authority before coding against that seam.
