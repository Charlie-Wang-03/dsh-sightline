# Resolver compatibility notes

Sightline's adapters make their evidence boundary explicit so a prediction is never mistaken for runtime observation.

## Codex

Compatibility identity: `codex-docs-2026-08-23`.

Authority reviewed on 2026-08-23:

- OpenAI, **Unrolling the Codex agent loop**: <https://openai.com/index/unrolling-the-codex-agent-loop/>

Implemented in the first core milestone:

- user-global instruction discovery under `$CODEX_HOME`;
- repository-root through `cwd` directory traversal;
- `AGENTS.override.md` preference over `AGENTS.md` within a directory;
- caller-supplied `project_doc_fallback_filenames` equivalents;
- a configurable project instruction byte budget, defaulting to the documented 32 KiB;
- deterministic source ordering and content digests;
- filesystem access through an injectable read-only capability (Node by default outside DSH; DSH `ctx.fs` when hosted by Harness).

Current limitation:

- Sightline does not parse `~/.codex/config.toml` yet. Fallback filenames and non-default byte limits must be supplied to the adapter by its caller. This is surfaced as implementation scope, not inferred silently.

## Claude Code

Compatibility identity: `claude-docs-2026-08-23-cwd-view`.

Authority reviewed on 2026-08-23:

- Anthropic, **Give Claude context: CLAUDE.md and better prompts**: <https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts>
- Anthropic, **Steering Claude Code: when to use CLAUDE.md, skills, hooks, rules, subagents and more**: <https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more>

Implemented in the first core milestone:

- `~/.claude/CLAUDE.md` user memory;
- repository-root through `cwd` `CLAUDE.md` layering;
- recursively discovered unscoped `.claude/rules/**/*.md` rules;
- deterministic source ordering and content digests;
- filesystem access through the same injectable read-only capability as Codex.

Important limitation:

- Claude path-scoped rules are activated when matching files are read, not merely from the session `cwd`. A cwd-only Sightline query therefore does **not** label such rules effective. They are detected, excluded from the effective surface, and reported with `claude-path-scoped-rules-deferred` instead of being guessed.

## DeepSeek Harness

Compatibility identity: `dsh-session-agent-instructions@0.1.1-rc.2/b150a551`.

Authority rechecked on 2026-08-24 against upstream commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`:

- the public `Agent` handle exposes its live `session`;
- the Session log is the append-only source of truth;
- `session/event` is the post-commit append observer feed;
- `dsh-agent-instructions` records typed `agent-instructions` sources in durable `user/message` events;
- `session.surface.nodes` identifies the current model-visible surface;
- `ToolRunContext.agent` binds a tool invocation to its owning agent/session;
- `@deepseek-ai/dsh-fs` defines the public `ctx.fs` filesystem capability with `resolve`, `stat`, `readText`, and `listDir` read primitives;
- `@deepseek-ai/dsh-fs-local` is the published local provider used by first-party compositions and by Sightline's focused host integration test.

`DshObservedAdapter` folds durable provenance and may return **observed** when the requested cwd matches the live Session and typed instruction provenance is present.

The DSH host plugin injects both `tools` and `fs`. Its repository-root probes and Codex/Claude predicted reads are adapted through `ctx.fs`, rather than directly opening host paths with Node `fs`. This keeps hosted Sightline in the same filesystem execution world as the Harness composition while the standalone core remains DSH-independent.

It deliberately returns `unavailable` when the Session or provenance cannot establish the effective surface. In particular, a Session with no typed `agent-instructions` source is not treated as proof of an empty DSH instruction view because the instruction plugin may simply be absent from that composition.

The observed adapter consumes a structural subset of the public Session handle instead of importing the internal `AgentInstructionSource` declaration from `@deepseek-ai/dsh-agent-instructions/src/state.ts`; that interface is not re-exported from the plugin root. See [`DSH_RUNTIME_SEAM.md`](DSH_RUNTIME_SEAM.md) for the evidence chain and fold contract, and [`DSH_HOST_TOOL.md`](DSH_HOST_TOOL.md) for host/tool plus filesystem-capability binding.
