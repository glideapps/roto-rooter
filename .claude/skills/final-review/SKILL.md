---
name: final-review
description: Performs a comprehensive pre-merge review of changes on the current branch. Use when the user wants to verify their work before merging, check PR readiness, or run a final validation of tests, types, lint, and PR metadata.
---

# Final Review Skill

Pre-merge review: `/final-review`

**Fix issues immediately without asking permission.** Report what was done.

## Process

### 1. Test Coverage

- Run `git diff main --name-only` to identify changed files
- Confirm each `src/checks/*.ts` has a corresponding `test/*.test.ts`
- Run `npm run test:run`

**Fix:** Write missing tests, fix failing tests, re-run until green.

### 2. Check Validity

For new checks in `src/checks/`:

- **Valid:** Requires cross-file context (route/component relationships, multi-file AST)
- **Invalid:** Could be an ESLint rule, examines single files, generic patterns

**Fix:** Flag invalid checks in report (requires user decision).

### 3. Build Verification

```bash
npm run typecheck && npm run lint && npm run build && npm test
```

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

### 5. PR Metadata (if PR exists)

- `gh pr view` - check current title/description
- `git log main..HEAD --oneline` - see commits
- `git diff main --stat` - see change scope

**Fix:** Use `gh pr edit --title` and `gh pr edit --body` to update.

### 6. Commit and Push

Stage, commit, and push all fixes made during review.

## Output

```
## Final Review Results

### Test Coverage
[x] Tests exist and pass
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

### PR Metadata
[x] Title and description accurate
Changes: <PR updates>

### Commits
<commits created>

## Verdict: READY TO MERGE | NEEDS MANUAL ATTENTION
```
