# Final Review Skill

Perform a final review before merging: `/final-review`

## Review Checklist

### 1. Test Coverage

Verify all changes in the local branch have proper test coverage:

- Run `git diff main --name-only` to identify changed files
- For each changed file in `src/checks/`, confirm a corresponding test file exists in `test/`
- For new functionality, confirm test cases cover the happy path and edge cases
- Run `npm run test:run` to ensure all tests pass

### 2. Check Validity

For any new checks added in `src/checks/`:

- Confirm the check requires cross-file application context (route/component relationships)
- Confirm the check cannot be implemented as an ESLint rule or other static analysis
- If a check could be an ESLint rule, flag it as invalid and explain why

Valid checks: cross-reference routes, components, and exports; validate references match actual application structure; require multi-file AST analysis.

Invalid checks: examine single files in isolation; check generic React/TypeScript patterns; could be a standard linter rule.

### 3. Build Verification

Run the full build and test suite:

```bash
npm run build
npm run test:run
```

Both commands must complete with zero errors and zero warnings.

### 4. PR Title and Description

Verify the pull request metadata matches the branch changes:

- Use `gh pr view` to check current PR title and description
- Use `git log main..HEAD --oneline` to see all commits in the branch
- Use `git diff main --stat` to see the full scope of changes
- Confirm PR title accurately summarizes the changes
- Confirm PR description covers all significant changes
- If updates are needed, use `gh pr edit` to fix the title/description

## Output Format

Provide a summary with status for each section:

```
## Final Review Results

### Test Coverage
[x] All changed files have corresponding tests
[ ] Missing tests: <list files>

### Check Validity
[x] All new checks require cross-file context
[ ] Invalid checks: <list with explanation>

### Build Status
[x] Build passes with no errors/warnings
[x] All tests pass

### PR Metadata
[x] Title accurately reflects changes
[x] Description covers full scope
[ ] Needs update: <suggestions>

## Verdict: READY / NEEDS WORK
```
