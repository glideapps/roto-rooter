---
name: final-review
description: Performs a comprehensive pre-merge review of changes on the current branch. Use when the user wants to verify their work before merging, check PR readiness, or run a final validation of tests, types, lint, and PR metadata.
---

# Final Review Skill

Pre-merge review: `/final-review`

**Fix issues immediately without asking permission.** Report what was done.

## Process

### 0. Fetch Latest

Run `git fetch origin main` to ensure comparisons use the latest main branch.

### 1. Test Coverage

- Run `git diff main --name-only` to identify changed files
- Confirm each `src/checks/*.ts` has a corresponding `test/*.test.ts`
- For checks with auto-fix support (issues have `fix` property), verify integration tests exist in `test/fix-integration.test.ts`
- CLI integration tests in `test/cli.test.ts` verify the built artifact runs correctly
- Run `npm test`

**Fix:** Write missing tests, fix failing tests, re-run until green.

### 1b. Fix Integration Test Verification

For any check that generates auto-fixes:

- Verify tests exist in `test/fix-integration.test.ts` that follow the pattern:
  1. Create fixture with known issue
  2. Run `analyze()` to detect issue with fix
  3. Run `applyFixes()` to apply fix
  4. Re-run `analyze()` to verify issue is resolved
  5. Verify file content is correct

**Fix:** Add missing fix integration tests following the existing patterns.

### 2. Check Validity

For new checks in `src/checks/`:

- **Valid:** Requires cross-file context (route/component relationships, multi-file AST)
- **Invalid:** Could be an ESLint rule, examines single files, generic patterns

**Fix:** Flag invalid checks in report (requires user decision).

### 3. Build Verification

```bash
npm run typecheck && npm run lint && npm run build && npm test
```

The test suite includes CLI integration tests that spawn the built `dist/cli.js` artifact, verifying the bundle is runnable.

**Fix:** Resolve type errors, lint errors, build errors. Re-run until zero errors/warnings.

### 4. Documentation Consistency

Verify all documentation sources are consistent:

- `README.md` - User-facing documentation
- `CLAUDE.md` - Agent instructions
- `.claude/skills/add-check/SKILL.md` - Existing checks table

Check for:

- All checks in `src/checks/` are listed in all docs
- Placeholder vs implemented status is consistent across docs
- Check descriptions match between files

**Fix:** Update any inconsistent or stale documentation.

### 5. Version Update

Check `package.json` version against change scope:

- **Major:** Breaking changes (removed features, incompatible API changes)
- **Minor:** New checks or features added
- **Patch:** Bug fixes, CLI option changes, documentation updates, refactoring

Any user-facing change requires at least a patch bump. This includes renaming CLI options, changing output formats, or modifying behavior even if functionality is preserved.

**Fix:** Update version in `package.json` if needed.

### 6. PR Metadata (if PR exists)

- `gh pr view` - check current title/description
- `git log main..HEAD --oneline` - see commits
- `git diff main --stat` - see change scope

**Fix:** Use `gh pr edit --title` and `gh pr edit --body` to update.

### 7. Commit and Push

Stage, commit, and push all fixes made during review.

## Output

```
## Final Review Results

### Test Coverage
[x] Unit tests exist and pass
[x] Fix integration tests exist for auto-fixable checks
Changes: <tests added/fixed>

### Check Validity
[x] All checks require cross-file context
Flagged: <any invalid checks>

### Build Status
[x] typecheck/lint/build/test all pass
Changes: <code fixes>

### Documentation Consistency
[x] All docs consistent
Changes: <doc updates>

### Version Update
[x] Version updated appropriately
Changes: <version bump type or "no change needed">

### PR Metadata
[x] Title and description accurate
Changes: <PR updates>

### Commits
<commits created>

## Verdict: READY TO MERGE | NEEDS MANUAL ATTENTION
```
