# DSH host/tool integration

Authority rechecked on 2026-08-24 against DeepSeek Harness `0.1.1-rc.2` at `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

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

## Filesystem capability binding

The DSH plugin injects both `tools` and the public `fs` service. Every host-side filesystem probe used for repository-root discovery and Codex/Claude prediction is adapted from `ctx.fs`; the DSH plugin path does not call Node `fs` directly.

This is an execution-world boundary, not merely a style preference. DSH defines `ctx.fs` as the filesystem capability seam so a deployment may use the local provider today or a sandboxed/remote/project-scoped provider without rewriting consumers. Sightline therefore keeps its core resolver interface DSH-agnostic and supplies one minimal read-only adapter at the host boundary:

```text
ctx.fs
  -> resolve(path)
  -> stat(target)
  -> readText(target)
  -> listDir(target)
  -> Sightline ReadOnlyFileAccess
  -> Codex / Claude prediction
```

Standalone use outside Harness still defaults to a Node-backed implementation of the same read-only interface. That default is never selected by `apply(ctx, ...)`; DSH registration always supplies the `ctx.fs` adapter.

The DSH caller signal is propagated through repository-root discovery and resolver I/O.

## Workspace binding

The live Session `cwd` is authoritative for the query.

For the repository root, Sightline follows the current DSH-style default root-marker contract used by workspace instruction discovery:

1. start at `cwd`;
2. walk upward to the nearest `.git` marker;
3. if no marker exists, use `cwd` itself.

The walk probes only the configured root marker through the same filesystem capability. It does not crawl neighboring files.

## Three evidence paths

For one resolved `{ repositoryRoot, cwd }`:

- **DSH — Observed:** `DshObservedAdapter` folds the calling Session's current typed `agent-instructions` provenance;
- **Codex — Predicted:** `CodexAdapter` reads only its documented instruction locations through the injected read-only filesystem capability;
- **Claude — Predicted:** `ClaudeCodeAdapter` reads only its documented memory/rule locations through the same capability.

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

The host integration follows the same level used by first-party DSH tool tests:

1. create a real `@deepseek-ai/cordis` `Context`;
2. mount published `@deepseek-ai/dsh-system-prompt@0.1.1-rc.2`;
3. mount published `@deepseek-ai/dsh-tools@0.1.1-rc.2` `ToolRuntime`;
4. mount published `@deepseek-ai/dsh-session@0.1.1-rc.2` `SessionStore`;
5. mount published `@deepseek-ai/dsh-fs-local@0.1.1-rc.2` as the real `ctx.fs` provider;
6. mount the Sightline plugin through `ctx.plugin(...)`;
7. create a real DSH `Session` with the test repository as its `cwd`;
8. append typed durable instruction provenance to that Session;
9. invoke the registered `sightline` tool through `ctx.tools.execute(...)` with a stand-in `Agent` carrying that real Session.

The test therefore exercises real Cordis plugin mounting, real DSH tool registration and dispatch, a real DSH Session log/surface, the public filesystem capability with the official local provider, actual Codex and Claude adapters, the pure comparison engine, DSH output validation, and the model-facing renderer. Only the full live Agent loop is represented by a minimal stand-in, matching the focused pattern used by upstream first-party tool tests.

The repository additionally keeps a compile-time compatibility gate against the published DSH Session type.

This milestone proves host/tool wiring and filesystem-capability alignment. It does **not** yet prove clean-profile bundle installation, Loader composition from an installed bundle, or the Web panel; those remain later acceptance steps.

## Fail-closed behavior

The host/tool layer rejects or preserves `unavailable` rather than guessing when:

- the tool call has no owning DSH agent;
- the live Session lacks a `cwd`;
- caller cancellation is already active or arrives at an observed boundary;
- the mounted filesystem capability cannot resolve/read a documented source;
- the DSH provenance adapter cannot establish authoritative instruction evidence;
- a static adapter encounters an unsupported or unreadable documented source;
- a replayed/policy-replaced JSON tool value no longer matches the current report shape.

No instruction file is modified and no network request is required to build the report.
