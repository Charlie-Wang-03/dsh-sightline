# Contributing

Thanks for considering a contribution to Sightline.

Sightline has a deliberately narrow product boundary: compare the effective workspace-instruction surfaces of DeepSeek Harness, Codex, and Claude Code for the same repository and working directory. Contributions should strengthen that job rather than turn the project into a general prompt-management suite.

## Before contributing

Read:

1. `AGENTS.md` — repository rules and invariants;
2. `docs/PRODUCT_CONTRACT.md` — v0.1 product and truth boundaries;
3. `docs/ARCHITECTURE.md` — adapter and comparison boundaries;
4. `docs/COMPATIBILITY.md` — external semantics currently encoded by Sightline.

For security-sensitive reports, follow `SECURITY.md` instead of opening a public issue with exploit details.

## Development setup

Requires a compatible Node.js version and pnpm 11.7.0.

```sh
pnpm install
pnpm run check
```

The current DeepSeek Harness compatibility baseline is `0.1.1-rc.2` / upstream commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` until intentionally revalidated and changed.

## Contribution expectations

Prefer focused changes with explicit evidence.

A useful pull request normally includes:

- the user-visible behavior being changed;
- the owning adapter or layer;
- focused tests for new discovery, precedence, evidence, or rendering behavior;
- compatibility evidence when external agent semantics are changed;
- documentation updates when observable behavior or limitations change;
- the verification commands and results.

Do not:

- label predictions as runtime observation;
- collapse `Unavailable` / `Unknown` into absence;
- add LLM-based semantic conflict detection to v0.1;
- auto-edit, synchronize, or rewrite user instruction files;
- depend on private DSH implementation paths when a public seam exists;
- submit unverified AI-generated changes merely to increase activity.

AI coding tools are welcome, but contributors remain responsible for understanding, testing, and explaining the submitted change.

## Pull requests

Keep pull requests small enough to review. If a change alters a public DSH seam, a Codex/Claude discovery rule, package installation, or the evidence model, explain the compatibility source and failure behavior explicitly.

The maintainer may ask for a narrower change when a proposal expands Sightline beyond its product contract.

## License

By contributing, you agree that your contribution is licensed under the repository's MIT License.
