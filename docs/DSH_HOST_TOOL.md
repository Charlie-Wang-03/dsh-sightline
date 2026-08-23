# DSH host/tool integration

Authority rechecked on 2026-08-23 against DeepSeek Harness `0.1.1-rc.2` at `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

## Runtime ownership

Sightline registers one argument-free DSH tool named `sightline` through the public `ctx.tools` registry.

The tool does not search the global agent registry and does not rely on ambient initiator state. DSH already supplies the calling agent on `ToolRunContext.agent`, so the observed column is bound directly to:

```text
tool execution
  -> exec.agent
  -> exec.agent.session
  -> current durable agent-instructions provenance
```

A call with no owning agent fails rather than substituting another session.

## Workspace binding

The live Session `cwd` is authoritative for the query.

For the repository root, Sightline follows the current DSH-style default root-marker contract used by workspace instruction discovery:

1. start at `cwd`;
2. walk upward to the nearest `.git` marker;
3. if no marker exists, use `cwd` itself.

The walk probes only the configured root marker. It does not crawl neighboring files. The DSH tool cancellation signal is checked before and during this work and again around report assembly.

## Three evidence paths

For one resolved `{ repositoryRoot, cwd }`:

- **DSH — Observed:** `DshObservedAdapter` folds the calling Session's current typed `agent-instructions` provenance;
- **Codex — Predicted:** `CodexAdapter` reads only its documented local/global instruction locations;
- **Claude — Predicted:** `ClaudeCodeAdapter` reads only its documented memory/rule locations.

The three surfaces feed the same pure comparison engine and produce one canonical `SightlineReport`.

## Tool output

The canonical tool value is the structured JSON report itself. The model-facing text is only a projection of that same value; it does not run another comparison path.

Because DSH can replay an older tool value or let post-execute policy replace a generic JSON value, the renderer is total: an incompatible stored value renders an explicit unavailable message instead of throwing during presentation.

The first focused integration produces this intentionally divergent shape:

```text
Same repo. Different agents. Different rules.

| Source | DSH (Observed) | Codex (Predicted) | Claude (Predicted) |
| --- | --- | --- | --- |
| AGENTS.md | ● | ● | |
| CLAUDE.md | ● | | ● |
| packages/api/AGENTS.md | ● | ● | |
| .claude/rules/always.md | | | ● |
```

The exact canonical report also retains evidence kinds, source order, digests when available, resolver compatibility identities, and diagnostics.

## Focused integration boundary

The host integration now follows the same level used by first-party DSH tool tests:

1. create a real `@deepseek-ai/cordis` `Context`;
2. mount the published `@deepseek-ai/dsh-system-prompt@0.1.1-rc.2`;
3. mount the published `@deepseek-ai/dsh-tools@0.1.1-rc.2` `ToolRuntime`;
4. mount the published `@deepseek-ai/dsh-session@0.1.1-rc.2` `SessionStore`;
5. mount the Sightline plugin through `ctx.plugin(...)`;
6. create a real DSH `Session` with the test repository as its `cwd`;
7. append typed durable instruction provenance to that Session;
8. invoke the registered `sightline` tool through `ctx.tools.execute(...)` with a stand-in `Agent` carrying that real Session.

The test therefore exercises real Cordis plugin mounting, real DSH tool registration and dispatch, a real DSH Session log/surface, actual Codex and Claude adapters, the pure comparison engine, DSH output validation, and the model-facing renderer. Only the full live `Agent` loop is represented by a minimal stand-in, matching the focused pattern used by upstream first-party tool tests.

The repository additionally keeps a compile-time compatibility gate against the published DSH Session type.

This milestone proves host/tool wiring. It does **not** yet prove clean-profile bundle installation, Loader composition from an installed bundle, or the Web panel; those remain later acceptance steps.

## Fail-closed behavior

The host/tool layer rejects or preserves `unavailable` rather than guessing when:

- the tool call has no owning DSH agent;
- the live Session lacks a `cwd`;
- caller cancellation is already active or arrives at an observed boundary;
- the DSH provenance adapter cannot establish authoritative instruction evidence;
- a static adapter encounters an unsupported or unreadable documented source;
- a replayed/policy-replaced JSON tool value no longer matches the current report shape.

No instruction file is modified and no network request is required to build the report.
