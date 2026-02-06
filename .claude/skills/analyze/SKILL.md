---
name: analyze
description: Red-team verification of roto-rooter findings against real apps. Supports multiple local paths and remote Git URLs. Runs all checks and SQL extraction, then spins up subagents to independently validate each finding. Use when the user wants to verify roto-rooter accuracy, test for false positives, or audit apps with third-party validation of results.
context: fork
agent: general-purpose
argument-hint: '[app-path ...]'
---

# Analyze Skill

Red-team verification of roto-rooter against one or more real applications.

## Target Apps

The raw arguments are: `$ARGUMENTS`

Parse `$ARGUMENTS` by splitting on whitespace to get a list of app targets. Each target is either a **local path** or a **remote URL**. If `$ARGUMENTS` is empty or not provided, ask the user which app(s) to analyze using AskUserQuestion.

### Classifying Targets

For each target, determine its type:

- **Remote URL** if it matches any of:
  - Starts with `https://` or `http://`
  - Starts with `git@`
  - Starts with `github.com/` (no protocol)
  - Ends with `.git`
- **Local path** otherwise

### Resolving Local Paths

For each local path target:

- If it is an absolute path, use it directly.
- If it is a relative path, resolve it relative to the current working directory.
- Verify the directory exists. If it does not, report an error for that target and skip it.

### Cloning Remote URLs

For each remote URL target:

1. Normalize the URL:
   - If the target is `github.com/user/repo` (no protocol), prepend `https://`
   - URLs like `https://github.com/user/repo` work as-is (git clone handles both with and without `.git`)
2. Create a unique temp directory:
   ```bash
   mktemp -d /tmp/rr-analyze-XXXXXX
   ```
3. Clone with shallow depth for speed:
   ```bash
   git clone --depth 1 <url> <temp-dir>/repo
   ```
4. If the clone fails, report the error for that target (include the URL and the error message) and skip it. Do not stop processing other targets.
5. The app path for this target is `<temp-dir>/repo`.
6. Track the temp directory for cleanup later.

### Deduplication

After resolving all targets, deduplicate by absolute path. If two arguments resolve to the same directory, analyze it only once.

### App List

After parsing, you should have a list of resolved app targets, each with:

- `label`: A short display name (directory basename for local paths, `user/repo` for GitHub URLs)
- `app_path`: The absolute path to analyze
- `is_remote`: Whether this was cloned from a URL
- `temp_dir`: The temp directory to clean up (only for remote targets)
- `source`: The original argument string (for display in reports)

If all targets failed to resolve, report the errors and stop.

## Overview

This skill performs adversarial validation of roto-rooter's output. It runs all static analysis checks and SQL extraction against one or more target apps, then independently verifies every finding using subagents that read the actual source code. The goal is to classify each finding as valid or false positive, and assess whether the diagnostic messages accurately describe the root cause and suggest the right fix. When multiple apps are provided, each is analyzed independently, and an aggregate summary is compiled at the end.

## Critical: CLI Invocation

**Never use the `rr` or `roto-rooter` system commands.** Always invoke the CLI by running the built artifact from this project directly with `node`. The SKILL.md file lives at `.claude/skills/analyze/SKILL.md` inside the roto-rooter project, so the project root is three directories up from this file.

Determine the roto-rooter project root by finding where this SKILL.md lives relative to the repo. The project root contains `package.json`, `dist/cli.js` (after build), and `src/`. In practice, it is the current working directory when the user invokes `/analyze` (since they're working in the roto-rooter repo).

Set a variable for clarity in your execution:

```
RR_PROJECT_ROOT = <the roto-rooter project root, i.e. the repo root>
RR_CLI = node <RR_PROJECT_ROOT>/dist/cli.js
```

All commands below use `RR_CLI` to ensure we exercise this project's version of roto-rooter, not a globally installed one.

## Process

### 1. Build Roto-Rooter

Build the CLI from this project to ensure the latest source is used:

```bash
npm run build --prefix <RR_PROJECT_ROOT>
```

Verify `<RR_PROJECT_ROOT>/dist/cli.js` exists after the build. If the build fails, report the error and stop.

### 2. Analyze Each App

For each target in the app list, perform steps 2a through 2e. Process apps **sequentially** (one at a time) to keep reports organized and avoid overwhelming the system with too many parallel subagents across apps.

If a step fails for one app, record the error and continue to the next app.

#### 2a. Run All Checks

Run this project's roto-rooter with all checks enabled against the current app, using JSON output:

```bash
node <RR_PROJECT_ROOT>/dist/cli.js --check all --format json --root <current-app-path>
```

**Do NOT use `rr` or `roto-rooter` commands.** Always use `node <RR_PROJECT_ROOT>/dist/cli.js` to guarantee we are running the version built from this project's source code.

Capture the JSON output. The output format is:

```json
{
  "issues": [
    {
      "category": "links|forms|loader|params|hydration|drizzle|interactivity",
      "severity": "error|warning",
      "message": "...",
      "file": "relative/path.tsx",
      "line": 15,
      "column": 5,
      "code": "...",
      "suggestion": "..."
    }
  ],
  "summary": { "total": N, "errors": N, "warnings": N }
}
```

**Important:** The command may exit with code 1 if it finds errors. This is expected -- capture the stdout output regardless of exit code. If the command fails to run at all (not found, crash, etc.), report the error for this app and move to the next one.

#### 2b. Run SQL Extraction

Run SQL extraction using this project's CLI against the current app:

```bash
node <RR_PROJECT_ROOT>/dist/cli.js sql --drizzle --format json --root <current-app-path>
```

Capture the JSON output. The output format is:

```json
{
  "totalQueries": N,
  "queries": [
    {
      "type": "SELECT|INSERT|UPDATE|DELETE",
      "sql": "SELECT ...",
      "tables": ["table_name"],
      "location": { "file": "path.tsx", "line": 42, "column": 5 },
      "code": "db.select()...",
      "parameters": [
        { "position": 1, "source": "variableName", "columnType": "integer" }
      ]
    }
  ]
}
```

**Note:** The SQL command may fail if the app does not use Drizzle ORM or has no schema. This is not an error -- simply note "No Drizzle ORM usage detected" in the SQL section of this app's report and skip SQL verification for this app.

#### 2c. Verify Check Findings (Parallel Subagents)

For each issue found in step 2a, launch an **Explore** subagent (using the Task tool with `subagent_type: "Explore"`) to independently verify the finding. Launch all subagents in parallel for maximum efficiency.

Each subagent should receive a prompt like this (fill in the actual values):

```
Verify this roto-rooter finding against the actual source code.

**Category:** {category}
**Severity:** {severity}
**File:** {file} (resolve to absolute path using the app root: <current-app-path>)
**Line:** {line}, Column: {column}
**Code snippet from roto-rooter:** {code}
**Message:** {message}
**Suggestion:** {suggestion}

Instructions:
1. Read the file at the specified location and examine the surrounding code context (at least 20 lines above and below).
2. If the check references other files (e.g., route definitions, loader exports, schema files), read those too.
3. Determine:
   a. Is this finding VALID or a FALSE POSITIVE?
      - VALID: The code genuinely has this issue
      - FALSE POSITIVE: The code is actually correct, or the check misunderstood the pattern
   b. Is the message accurate? Does it correctly describe the root cause?
   c. Is the suggestion helpful? Does it point to the right fix?
   d. Is the severity appropriate? (error = breaks functionality, warning = quality issue)

Respond with a structured assessment:
- classification: "valid" or "false_positive"
- message_accuracy: "accurate", "misleading", or "incorrect"
- suggestion_quality: "helpful", "unhelpful", "missing", or "incorrect"
- severity_appropriate: true or false
- reasoning: 1-2 sentence explanation of your determination
- brief_description: A short (under 15 words) summary of what the issue is about
```

**Batching:** If there are more than 20 issues, batch them into groups of up to 10 and process batches sequentially to avoid overwhelming the system. Each batch should launch its subagents in parallel.

#### 2d. Verify SQL Statements (Parallel Subagents)

For each SQL query found in step 2b, launch an **Explore** subagent to verify the accuracy of the extracted SQL. Launch all subagents in parallel.

Each subagent should receive a prompt like this:

```
Verify this SQL statement extracted by roto-rooter from Drizzle ORM code.

**Query type:** {type}
**Extracted SQL:** {sql}
**Tables:** {tables}
**File:** {file} (resolve to absolute path using the app root: <current-app-path>)
**Line:** {line}
**Original code:** {code}
**Parameters:** {parameters formatted as list}

Instructions:
1. Read the source file at the specified location and examine the Drizzle ORM code.
2. Read the Drizzle schema file to understand the table definitions.
3. Determine:
   a. Does the extracted SQL accurately represent what the Drizzle code does?
   b. Are the table and column names correct?
   c. Are the WHERE clauses, JOINs, and other SQL operations correct?
   d. Are the parameters correctly identified?

Respond with:
- accurate: true or false
- issues: List any discrepancies (empty list if accurate)
- reasoning: 1-2 sentence explanation
```

**Batching:** Same rules as check findings -- batch into groups of 10 if there are more than 20 queries.

#### 2e. Compile Per-App Report

After all subagents complete for this app, compile the per-app report section using the table format described in the Output Format section below.

### 3. Cleanup Remote Repositories

After ALL apps have been analyzed (not after each individual app), clean up temp directories for remote targets:

```bash
rm -rf <temp_dir>
```

Do this for every target where `is_remote` is true. Cleaning up after all analysis is complete ensures subagents can still re-read files if needed during verification.

If cleanup fails, report a warning but do not fail the overall analysis.

### 4. Compile Aggregate Report

If multiple apps were analyzed, compile an aggregate summary after all per-app reports. See the Output Format section below for the structure.

## Output Format

### Single App

When only one app is analyzed, use this format (no aggregate section needed):

```
## Roto-Rooter Analysis Report

App: <source>
Date: <current date>

### Check Findings

| # | Category | File:Line | Description | Severity | Classification | Notes |
|---|----------|-----------|-------------|----------|----------------|-------|
| 1 | links    | routes/users.tsx:15 | Broken link to /employ | error | VALID | Message accurate, suggestion helpful |
| 2 | hydration | routes/dashboard.tsx:42 | Date rendered in SSR | warning | FALSE POSITIVE | Component uses useEffect guard |
| ... | | | | | | |

Summary: X findings total, Y valid, Z false positives
Accuracy rate: N%

### SQL Statements

| # | Type | File:Line | SQL Statement | Accurate |
|---|------|-----------|---------------|----------|
| 1 | SELECT | routes/users.tsx:42 | SELECT id, name FROM users WHERE id = $1 | Yes |
| 2 | INSERT | routes/users.tsx:58 | INSERT INTO users (name, email) VALUES ($1, $2) | No - missing created_at column |
| ... | | | | |

Summary: X queries total, Y accurate, Z inaccurate
Accuracy rate: N%

### Overall Assessment

- Check accuracy: N% (Y/X findings were valid)
- SQL accuracy: N% (Y/X queries were accurate)
- False positive categories: <list which check categories had false positives>
- Recommendations: <brief notes on patterns that caused false positives>
```

### Multiple Apps

When multiple apps are analyzed, produce per-app sections followed by an aggregate summary:

```
## Roto-Rooter Analysis Report

Date: <current date>
Apps analyzed: <count>

---

### App 1: <label> (<source>)

#### Check Findings

| # | Category | File:Line | Description | Severity | Classification | Notes |
|---|----------|-----------|-------------|----------|----------------|-------|
| 1 | links    | routes/users.tsx:15 | Broken link to /employ | error | VALID | Message accurate |
| ... | | | | | | |

Summary: X findings total, Y valid, Z false positives
Accuracy rate: N%

#### SQL Statements

| # | Type | File:Line | SQL Statement | Accurate |
|---|------|-----------|---------------|----------|
| 1 | SELECT | routes/users.tsx:42 | SELECT id, name FROM users WHERE id = $1 | Yes |
| ... | | | | |

Summary: X queries total, Y accurate, Z inaccurate
Accuracy rate: N%

---

### App 2: <label> (<source>)

(Same structure as App 1)

---

(If an app failed entirely, show:)

### App N: <label> (<source>)

Analysis failed: <error message>

---

### Aggregate Summary

| App | Source | Check Findings | Valid | False Positives | Check Accuracy | SQL Queries | SQL Accurate | SQL Accuracy |
|-----|--------|----------------|-------|-----------------|----------------|-------------|--------------|--------------|
| <label> | <source> | X | Y | Z | N% | X | Y | N% |
| <label> | <source> | X | Y | Z | N% | X | Y | N% |
| **Total** | | **X** | **Y** | **Z** | **N%** | **X** | **Y** | **N%** |

### Overall Assessment

- Apps analyzed: N (M successful, K failed)
- Overall check accuracy: N% (Y/X findings were valid across all apps)
- Overall SQL accuracy: N% (Y/X queries were accurate across all apps)
- False positive categories: <list which check categories had false positives, noting which apps>
- Cross-app patterns: <any patterns that appeared in multiple apps>
- Recommendations: <brief notes on patterns that caused false positives>
```

## Important Notes

- **Always use `--format json`** for both commands to get machine-parseable output.
- **Resolve file paths** to absolute paths when passing to subagents so they can read the files. The JSON output uses paths relative to the app root.
- **Exit codes:** `rr` exits with code 1 when errors are found. Capture stdout regardless by using `; true` or `|| true` after the command, or by redirecting to a file.
- **No Drizzle:** If the app doesn't use Drizzle ORM, the SQL command will fail. This is fine -- just skip the SQL section and note it in the report.
- **No issues found:** If roto-rooter finds zero issues, report that and skip verification. The report should still note "0 issues found -- no verification needed."
- **Thoroughness level for subagents:** Use "very thorough" in the Explore agent prompts since we need deep verification of each finding.
- **Do not modify any target app.** This is a read-only analysis.
- **Multiple apps:** Each app is analyzed independently and sequentially. Subagents for one app complete before starting the next app.
- **Remote URL failures:** If a git clone fails (bad URL, private repo, network error), log the error and continue with remaining apps. The failed app appears in the report as "Analysis failed."
- **Temp directory cleanup:** Always clean up cloned repo temp directories after all analysis is complete. Use `rm -rf` on each temp directory tracked during cloning.
- **GitHub URL formats:** Handle common formats: `https://github.com/user/repo`, `https://github.com/user/repo.git`, `git@github.com:user/repo.git`, and bare `github.com/user/repo`.
- **Path deduplication:** If two arguments resolve to the same absolute path, analyze only once to avoid redundant work.
