# v0.1.0 Release Readiness Checklist

This checklist is the release gate for the first public Sightline release. Passing an individual item is evidence for that item only; it is not a certification of the whole project.

## A. Product and truth boundary

- [x] v0.1 product scope is frozen in `docs/PRODUCT_CONTRACT.md`.
- [x] DSH `Observed`, Codex / Claude `Predicted`, and `Unavailable` remain distinct truth states.
- [x] Core operation is read-only and local-first.
- [x] Privacy wording distinguishes the full canonical report from the model-facing projection.
- [x] Model-facing renderer omits absolute workspace paths and full diagnostic messages by default; regression-covered in CI.

## B. Legal and community

- [x] MIT License selected and committed.
- [x] `package.json` declares `license: MIT` and public repository metadata.
- [x] `SECURITY.md` defines vulnerability reporting and product security boundaries.
- [x] `CONTRIBUTING.md` defines contribution expectations and v0.1 scope discipline.
- [x] README contains an independent-community-project disclaimer.

## C. Packaging and reproducibility

- [x] npm prebuilt package selected as the primary public installation path.
- [x] package manifest is publishable and uses `publishConfig.access: public`.
- [x] installable DSH bundle and Web client exports are implemented.
- [x] clean-profile packed-artifact installation has passed.
- [x] `pnpm-lock.yaml` generated and committed with pnpm 11.7.0.
- [x] CI installs with `pnpm install --frozen-lockfile`.
- [x] CI verifies the packed artifact contains required public surfaces and rejects unexpected development/sensitive paths.
- [ ] Verify the live npm package name `dsh-sightline` is available or choose the final package name.

## D. Verification

- [x] TypeScript typecheck exists.
- [x] Automated suite passes **19 / 19** on the release-readiness branch before the frozen-lockfile gate.
- [x] Real DSH `ToolRuntime + SessionStore + dsh-fs-local` integration exists.
- [x] Browser ToolView registration/render smoke exists.
- [x] Clean-profile CI exists.
- [x] Human Windows DSH Web smoke has been completed against `0.1.1-rc.2` on the pre-hardening v0.1 package.
- [ ] Confirm the final frozen-lockfile release-readiness CI passes on Ubuntu, Windows, and clean-profile packed installation.
- [ ] Run final Windows local smoke from the final release-candidate artifact.

## E. Security and privacy release gate

- [ ] Run a full Git history secret scan from a local clone.
- [ ] Review commit author metadata for unintended personal email / PII exposure.
- [ ] Run dependency vulnerability review (`pnpm audit` or equivalent) and triage findings rather than blindly suppressing them.
- [ ] Review package licenses for unexpected incompatible dependencies.
- [x] CI rejects unexpected development/sensitive paths in the packed artifact; final human tarball inspection remains part of the release-candidate smoke.
- [ ] Re-run the source-backed security review on the final release diff / commit after all manual evidence is incorporated.

## F. Public launch surface

- [x] English README rewritten around product value, proof, quick start, trust boundary, and compatibility.
- [x] Simplified Chinese README added as a first-class entry path.
- [ ] Add one real, publication-safe Sightline ToolView screenshot to the README if it materially improves the launch page.
- [ ] Configure GitHub repository Description and Topics after public release preparation is complete.
- [ ] Configure a social preview image if one is available and publication-safe.

## G. npm publishing

- [ ] Confirm npm account access and package-name availability.
- [ ] Decide and configure the first-publish authentication path.
- [ ] Prefer npm Trusted Publishing + provenance after the package/publisher relationship can be configured.
- [ ] Publish the exact prebuilt `0.1.0` artifact.
- [ ] Verify `npm view dsh-sightline@0.1.0` metadata and package contents after publication.
- [ ] Verify a clean DSH profile can install from npm, not from the repository checkout.

## H. GitHub public release

- [ ] Merge the release-readiness PR only after automated and manual gates pass.
- [ ] Remove stale merged development branches that no longer serve a purpose.
- [ ] Make the repository public.
- [ ] Enable appropriate default-branch protection.
- [ ] Enable private vulnerability reporting.
- [ ] Add `dsh-plugin` and related discovery topics.
- [ ] Create signed/annotated release tag `v0.1.0` according to the final repository release policy.
- [ ] Publish GitHub Release notes tied to the exact tested commit.
- [ ] Verify all public README links, install commands, license surfaces, and security links after visibility changes.

## Release decision

The repository is **NO-GO for public release** while any of the following remain unresolved:

- license missing or inconsistent;
- privacy contract inconsistent with actual model-facing behavior;
- no verified public installation path;
- dependency lock / reproducibility gate incomplete;
- history / secret audit incomplete;
- final release candidate CI or smoke failing;
- npm package identity / publication not verified.

Once those blockers are closed, remaining launch-polish items may be evaluated as proportional trade-offs rather than automatic blockers.
