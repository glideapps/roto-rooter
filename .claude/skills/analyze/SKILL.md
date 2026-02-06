---
name: analyze
description: Red-team verification of roto-rooter findings against a real app. Runs all checks and SQL extraction, then spins up subagents to independently validate each finding. Use when the user wants to verify roto-rooter accuracy, test for false positives, or audit an app with third-party validation of results.
context: fork
agent: general-purpose
argument-hint: '[app-path]'
---

# Analyze Skill

Red-team verification of roto-rooter against a real application.

## Target App: `$ARGUMENTS`

The target app path is: `$ARGUMENTS`

Use this as `<app-path>` throughout the rest of these instructions. If it is an absolute path, use it directly. If it is a relative path, resolve it relative to the current working directory. If `$ARGUMENTS` is empty or not provided, ask the user which app to analyze using AskUserQuestion.

## Overview

This skill performs adversarial validation of roto-rooter's output. It runs all static analysis checks and SQL extraction against a target app, then independently verifies every finding using subagents that read the actual source code. The goal is to classify each finding as valid or false positive, and assess whether the diagnostic messages accurately describe the root cause and suggest the right fix.

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

### 2. Run All Checks

Run this project's roto-rooter with all checks enabled against the target app, using JSON output:

```bash
node <RR_PROJECT_ROOT>/dist/cli.js --check all --format json --root <app-path>
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

**Important:** The command may exit with code 1 if it finds errors. This is expected -- capture the stdout output regardless of exit code. If the command fails to run at all (not found, crash, etc.), report the error and stop.

### 3. Run SQL Extraction

Run SQL extraction using this project's CLI against the same app:

```bash
node <RR_PROJECT_ROOT>/dist/cli.js sql --drizzle --format json --root <app-path>
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

**Note:** The SQL command may fail if the app does not use Drizzle ORM or has no schema. This is not an error -- simply note "No Drizzle ORM usage detected" in the SQL section of the report and skip SQL verification.

### 4. Verify Check Findings (Parallel Subagents)

For each issue found in step 2, launch an **Explore** subagent (using the Task tool with `subagent_type: "Explore"`) to independently verify the finding. Launch all subagents in parallel for maximum efficiency.

Each subagent should receive a prompt like this (fill in the actual values):

```
Verify this roto-rooter finding against the actual source code.

**Category:** {category}
**Severity:** {severity}
**File:** {file} (resolve to absolute path using the app root: <app-path>)
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

### 5. Verify SQL Statements (Parallel Subagents)

For each SQL query found in step 3, launch an **Explore** subagent to verify the accuracy of the extracted SQL. Launch all subagents in parallel.

Each subagent should receive a prompt like this:

```
Verify this SQL statement extracted by roto-rooter from Drizzle ORM code.

**Query type:** {type}
**Extracted SQL:** {sql}
**Tables:** {tables}
**File:** {file} (resolve to absolute path using the app root: <app-path>)
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

### 6. Compile Report

After all subagents complete, compile the results into a structured report. Use plain text table formatting (no emojis).

## Output Format

```
## Roto-Rooter Analysis Report

App: <app-path>
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

## Important Notes

- **Always use `--format json`** for both commands to get machine-parseable output.
- **Resolve file paths** to absolute paths when passing to subagents so they can read the files. The JSON output uses paths relative to the app root.
- **Exit codes:** `rr` exits with code 1 when errors are found. Capture stdout regardless by using `; true` or `|| true` after the command, or by redirecting to a file.
- **No Drizzle:** If the app doesn't use Drizzle ORM, the SQL command will fail. This is fine -- just skip the SQL section and note it in the report.
- **No issues found:** If roto-rooter finds zero issues, report that and skip verification. The report should still note "0 issues found -- no verification needed."
- **Thoroughness level for subagents:** Use "very thorough" in the Explore agent prompts since we need deep verification of each finding.
- **Do not modify the target app.** This is a read-only analysis.
