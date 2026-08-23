# Architecture

## 1. Design objective

Sightline must compare three different instruction systems without mixing their semantics together.

The central architectural rule is:

> Agent-specific discovery and precedence live in adapters; comparison operates only on normalized effective surfaces.

This keeps DSH, Codex, and Claude behavior independently testable and prevents the comparison engine from becoming a pile of tool-specific conditionals.

## 2. High-level system

```text
                       +---------------------+
workspace ------------>| Codex adapter       |-- predicted surface --+
                       +---------------------+                       |
                                                                   |
                       +---------------------+                       |
workspace ------------>| Claude adapter      |-- predicted surface --+--> normalize --> compare --> report
                       +---------------------+                       |
                                                                   |
DSH session evidence ->+---------------------+                       |
                       | DSH adapter          |-- observed surface ---+
                       +---------------------+

canonical report --> DSH tool/API
                 \-> compact Web panel
```

## 3. Core domain model

The initial public internal contract lives in `src/contracts.ts`.

### `AgentId`

Exactly:

- `dsh`
- `codex`
- `claude-code`

Do not add generic string extension points in v0.1. A closed union makes accidental product-scope expansion visible in code review.

### `EvidenceKind`

- `observed` — derived from an authoritative runtime/session seam.
- `predicted` — derived from documented semantics plus local state.
- `unavailable` — Sightline cannot establish a trustworthy surface.

`unavailable` is not equivalent to an empty surface.

### `InstructionSource`

Represents one logical instruction source after adapter resolution. It should carry:

- a stable normalized source key;
- display path/name;
- scope kind;
- order within that adapter's effective surface;
- optional content digest when available and safe;
- adapter-owned metadata needed to explain provenance.

Source identity and content identity must remain separate.

### `EffectiveInstructionSurface`

One adapter's result for one `cwd`:

- agent;
- evidence kind;
- resolver compatibility identity;
- ordered sources;
- diagnostics.

### `SightlineReport`

The comparison engine's canonical result. It is presentation-neutral and deterministic.

The DSH tool/API and Web panel must render the same report model rather than implementing two independent comparison paths.

## 4. Adapter boundary

Each adapter implements the conceptual contract:

```ts
interface InstructionAdapter {
  readonly agent: AgentId
  resolve(input: ResolveInput): Promise<EffectiveInstructionSurface>
}
```

Adapters own:

- where they look for sources;
- how they determine project/global scope;
- discovery order;
- precedence/order semantics;
- compatibility/version notes;
- diagnostics for unsupported cases.

Adapters do **not** own:

- cross-agent comparison;
- UI formatting;
- generic path normalization policy shared by all adapters;
- semantic evaluation of instruction text.

## 5. DSH adapter

### Evidence source

The DSH column is intended to be runtime-observed.

The implementation phase must verify the current public DSH seam that exposes durable instruction provenance for a live session. The baseline repository already emits typed `agent-instructions` source metadata in durable session history, but this is a developer-preview surface and must be re-validated before binding to it.

### Required behavior

- If authoritative session evidence exists, return `observed`.
- If the relevant public seam is missing, unsupported, or the session has no trustworthy evidence, return `unavailable` with a diagnostic.
- Do not silently reimplement DSH filesystem discovery and label it observed.

A future product version may add an explicitly labelled DSH prediction mode, but that is outside the v0.1 contract.

## 6. Codex adapter

The Codex resolver is static/predictive in v0.1.

It should model documented Codex workspace-instruction discovery, including global/project layering, nested scope traversal to the target `cwd`, documented override/fallback naming, and any documented size/config constraints that materially change the effective source set.

The resolver must expose a compatibility identifier describing the documentation/behavior version it implements.

The implementation must use fixtures to cover at least:

- root-only instruction;
- nested instruction override/layering;
- global plus project sources;
- override-file preference;
- configured fallback names if supported;
- Windows and POSIX path identity.

## 7. Claude Code adapter

The Claude resolver is static/predictive in v0.1.

It should model documented Claude Code project/user memory and rule-loading behavior relevant to the target workspace. The architecture must keep always-loaded memory sources distinct from path-scoped rule sources when that distinction affects the effective surface.

The resolver must expose a compatibility identifier.

Fixtures should cover at least:

- user/project `CLAUDE.md` layering;
- nested/specific instruction scope where documented;
- `.claude/rules/` always-loaded entries;
- path-scoped rules;
- a target path that does and does not match a scoped rule.

## 8. Normalization

Normalization converts adapter-owned source records into comparable identities without erasing meaningful differences.

Rules:

- Use repository-relative logical paths when a source belongs to the repository.
- Preserve an explicit namespace for global/user-level sources.
- Normalize separators for comparison while retaining the original display path.
- Do not case-fold paths unless the owning filesystem semantics justify it and tests prove the intended behavior.
- Do not use content digest as the sole source key.
- Preserve agent-specific order separately from cross-agent source identity.

## 9. Comparison engine

The comparison layer must be a pure function over normalized surfaces.

For each normalized source key it derives per-agent presence:

- `present`
- `absent`
- `unknown`

`unknown` is used when an adapter surface is `unavailable` or when that adapter cannot establish the source's status.

The engine should also report:

- sources shared by all established surfaces;
- subset-only sources;
- ordering differences when the same source set is ordered differently;
- per-agent evidence kind and diagnostics.

No prose-content similarity or contradiction inference belongs here in v0.1.

## 10. Presentation surfaces

### Machine-readable surface

A DSH tool or host API should return the canonical `SightlineReport` or a lossless serializable projection of it.

### Web panel

The first UI should be deliberately small:

- target `cwd`;
- three agent columns;
- evidence badges (`Observed`, `Predicted`, `Unavailable`);
- source rows;
- divergence count/filter;
- expandable provenance details.

Avoid building a general settings dashboard or context analytics suite.

## 11. Package/integration shape

DeepSeek Harness currently distributes third-party plugins as installable bundles with a `dsh.bundle` manifest and `cordis.patch.yml` layer. The runtime implementation should follow the current supported bundle mechanism rather than patching the DSH repository.

Planned repository shape:

```text
dsh-sightline/
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── docs/
│   ├── PRODUCT_CONTRACT.md
│   └── ARCHITECTURE.md
└── src/
    ├── contracts.ts       # normalized domain and adapter contracts
    ├── index.ts           # package exports
    ├── core/              # later: normalize + compare
    ├── adapters/          # later: dsh / codex / claude-code
    ├── host/              # later: DSH host/tool integration
    └── client/            # later: compact DSH panel
```

Only the first two source files exist in the skeleton. Additional directories should be created when implementation begins, not pre-filled with placeholders.

## 12. Dependency policy

The core comparison engine should stay dependency-light.

Before adding a runtime package, ask whether the same behavior can be expressed with:

- platform APIs;
- DSH public services already present in the host;
- a small pure function.

Do not bundle duplicate DSH/Cordis runtimes into the plugin. DSH-owned runtime packages should use the host-compatible peer/public-service model selected during the integration phase.

## 13. Test strategy

The intended pyramid is:

1. pure unit tests for normalization/comparison;
2. table/fixture tests for Codex and Claude discovery semantics;
3. focused DSH host integration proving observed provenance;
4. packed-plugin install smoke in a clean DSH profile;
5. one visual/snapshot smoke for the compact panel if the current DSH client testing surface supports it.

A passing static resolver test must never be used as proof of DSH runtime observation.

## 14. Current compatibility baseline

As of 2026-08-23:

- DeepSeek Harness: `0.1.1-rc.2`
- upstream commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- Node: `^22.19.0 || >=24.0.0`
- pnpm: `11.7.0`

Before the first executable integration commit, re-fetch upstream `master` and re-read the current plugin publishing/configuration docs and the exact session/client seams Sightline will use.
