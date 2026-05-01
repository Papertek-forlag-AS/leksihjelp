---
f_id: F38-1
severity: blocker
sync_status: extension-only
regression_fixture_id: TBD
walkthrough_id: UAT-EXT-XX
discovered: TBD
status: open
---

<!--
This is a TEMPLATE. Copy to `.planning/uat/findings/F<phase>-<seq>.md` and fill placeholders.
The `regression_fixture_id` field is HARD-required per FIX-02 — school-year stakes, no exceptions.

Frontmatter field guidance:
- f_id: F<phase>-<seq>; formalises F36-1 precedent (e.g. F38-1)
- severity: blocker | major | minor | trivial
- sync_status: synced-upstream | needs-resync | extension-only
- regression_fixture_id: e.g. fixtures/<lang>/<rule>.jsonl#<id>
                          OR benchmark-texts/expectations.json#<id>
                          HARD requirement, school-year stakes
- walkthrough_id: back-reference to the walkthrough (e.g. UAT-EXT-01)
- discovered: ISO-8601
- status: open | fixing | closed
-->


# F<phase>-<seq>: <one-line summary>

## Reproduction

Minimal repro steps. Each step a single observable. End with the actual incorrect output (paste verbatim).

1. <step>
2. <step>
3. <step>

**Observed output:**

```
<paste verbatim — DOM excerpt, console message, screenshot path, etc.>
```

**Expected output:**

```
<what should have happened>
```

## Root cause hypothesis

<short paragraph — where in the code (file:line if known), why it manifests, how it slipped past existing release gates>

## Fix tracking

- [ ] Extension fix landed (commit: `<hash>`)
- [ ] Regression artifact added (`regression_fixture_id` in frontmatter resolves to a real, asserting test)
- [ ] All release gates green (`npm run check-fixtures` + every other gate from CLAUDE.md Release Workflow)
- [ ] Version bumped in 3 places (`extension/manifest.json`, `package.json`, `backend/public/index.html`)
- [ ] `npm run package` rebuild + zip uploaded as GitHub Release asset
- [ ] Lockdown re-sync (only if `sync_status: needs-resync`): bumped `@papertek/leksihjelp` pin, ran sync script, re-walked the lockdown surface
