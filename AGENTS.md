# AGENTS.md

## Repository purpose

`dsh-sightline` is a DeepSeek Harness ecosystem plugin that compares the effective workspace-instruction surfaces of DeepSeek Harness, Codex, and Claude Code for the same repository and working directory.

The product wedge is **cross-agent effective-view divergence**. Do not broaden the project into a generic prompt linter, instruction synchronizer, context optimizer, or agent-configuration suite.

## Read first

Before making a non-trivial change, read:

1. `docs/PRODUCT_CONTRACT.md`
2. `docs/ARCHITECTURE.md`
3. the current DeepSeek Harness plugin/development documentation relevant to the seam being changed

When DSH behavior may have changed, verify current upstream source or documentation instead of relying on historical assumptions.

## v0.1 invariants

- Supported agents are exactly: DeepSeek Harness, Codex, and Claude Code.
- DSH runtime evidence may be labelled **observed** only when it comes from an actual DSH runtime/session provenance seam.
- Codex and Claude Code results are **predicted** from documented semantics and local files unless a future implementation obtains authoritative runtime evidence.
- Never collapse `observed`, `predicted`, and `unavailable` into one confidence state.
- Comparison is deterministic and structural in v0.1. Do not add LLM-based semantic conflict detection.
- Do not auto-edit, synchronize, rewrite, or delete user instruction files.
- Runtime behavior should be local-first and network-free. Documentation/research tooling may use the network during development, but the shipped plugin must not require it for core operation.
- Prefer read-only public DSH seams. Do not patch DeepSeek Harness core or depend on private implementation details when a public service/event contract exists.
- When a required fact cannot be established, return `unavailable` or an explicit diagnostic rather than guessing.

## Architecture rules

- Agent-specific discovery and precedence semantics belong behind adapters.
- The comparison engine must not contain agent-specific filesystem rules.
- Normalize path identity deliberately; do not assume Windows and POSIX path text are interchangeable.
- Keep source identity separate from content identity. Two agents may load the same file under different effective precedence, and different files may have equal content.
- Any semantics encoded from external agent documentation must be traceable to a version/date or compatibility note.
- Prefer small pure functions and fixture-driven tests for discovery/precedence behavior.

## Toolchain baseline

Until intentionally revised, align with the current DSH baseline used by this project:

- Node: `^22.19.0 || >=24.0.0`
- pnpm: `11.7.0`
- TypeScript: current DSH-compatible major

Do not add framework or runtime dependencies without a concrete v0.1 need.

## Change discipline

For non-trivial changes:

1. state the product behavior being changed;
2. identify the owning layer/adaptor;
3. add or update focused tests before broad integration work;
4. keep documentation aligned with observable behavior;
5. review the final diff for accidental scope expansion.

Default agent permission is LOCAL-EDIT. Do not commit, push, publish, create releases, or modify repository settings unless explicitly authorized.
