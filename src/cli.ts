import * as path from 'path';
import { analyze, ALL_CHECKS } from './analyzer.js';
import { applyFixes } from './fixer.js';
import type { CliOptions, FixResult } from './types.js';
import { formatIssues } from './utils/format-issue.js';
import { formatResultJson } from './utils/format-json.js';
import {
  extractSqlQueries,
  formatSqlResultsText,
  formatSqlResultsJson,
} from './sql-extractor.js';
import {
  discoverSchemaPath,
  parseDrizzleSchema,
} from './parsers/drizzle-schema-parser.js';

// Injected by esbuild at build time
declare const __VERSION__: string;

function getVersion(): string {
  return typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';
}

function main(): void {
  const args = process.argv.slice(2);

  // Check if this is a subcommand
  const firstArg = args[0];
  if (firstArg === 'sql') {
    runSqlCommand(args.slice(1));
    return;
  }

  const options = parseArgs(args);

  if (options.version) {
    console.log(getVersion());
    process.exit(0);
  }

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const result = analyze(options);

  // Handle --fix or --dry-run mode
  if (options.fix || options.dryRun) {
    const fixResult = applyFixes(result.issues, options.dryRun ?? false);

    if (options.format === 'json') {
      console.log(JSON.stringify({ ...result, fixResult }, null, 2));
    } else {
      printFixOutput(fixResult, options.dryRun ?? false);
    }

    // Exit with error code if there are still unfixable errors
    const remainingErrors = fixResult.unfixableIssues.filter(
      (i) => i.severity === 'error'
    ).length;
    if (remainingErrors > 0) {
      process.exit(1);
    }
    return;
  }

  // Normal mode - just report issues
  if (options.format === 'json') {
    const jsonOutput = formatResultJson(result);
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    console.log(formatIssues(result.issues));
  }

  // Exit with error code if there are issues
  const errorCount = result.issues.filter((i) => i.severity === 'error').length;
  if (errorCount > 0) {
    process.exit(1);
  }
}

// ============================================================================
// SQL Command
// ============================================================================

interface SqlCommandOptions {
  help: boolean;
  orm: string;
  format: 'text' | 'json';
  root: string;
  drizzleSchemaPath?: string;
  files: string[];
}

function parseSqlArgs(args: string[]): SqlCommandOptions {
  const options: SqlCommandOptions = {
    help: false,
    orm: '',
    format: 'text',
    root: process.cwd(),
    files: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      i++;
      continue;
    }

    if (arg === '--drizzle') {
      options.orm = 'drizzle';
      i++;
      continue;
    }

    if (arg === '--drizzle-schema') {
      const value = args[i + 1];
      if (value) {
        options.drizzleSchemaPath = path.resolve(value);
      }
      i += 2;
      continue;
    }

    if (arg === '--format' || arg === '-f') {
      const value = args[i + 1];
      if (value === 'json' || value === 'text') {
        options.format = value;
      }
      i += 2;
      continue;
    }

    if (arg === '--root' || arg === '-r') {
      const value = args[i + 1];
      if (value) {
        options.root = path.resolve(value);
      }
      i += 2;
      continue;
    }

    // Positional argument - file to analyze
    if (!arg.startsWith('-')) {
      options.files.push(arg);
    }

    i++;
  }

  return options;
}

function runSqlCommand(args: string[]): void {
  const options = parseSqlArgs(args);

  if (options.help) {
    printSqlHelp();
    process.exit(0);
  }

  if (!options.orm) {
    console.error(
      'Error: You must specify an ORM. Use --drizzle to analyze Drizzle ORM queries.'
    );
    process.exit(1);
  }

  if (options.orm !== 'drizzle') {
    console.error(
      `Error: Unsupported ORM '${options.orm}'. Currently only --drizzle is supported.`
    );
    process.exit(1);
  }

  // Find and parse the Drizzle schema
  const schemaPath =
    options.drizzleSchemaPath || discoverSchemaPath(options.root);
  if (!schemaPath) {
    console.error(
      'Error: Could not find Drizzle schema. Use --drizzle-schema to specify the path.'
    );
    process.exit(1);
  }

  let schema;
  try {
    schema = parseDrizzleSchema(schemaPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error parsing Drizzle schema: ${message}`);
    process.exit(1);
  }

  // Extract SQL queries
  const results = extractSqlQueries({
    root: options.root,
    files: options.files,
    schema,
  });

  // Output results
  if (options.format === 'json') {
    console.log(
      JSON.stringify(formatSqlResultsJson(results, options.root), null, 2)
    );
  } else {
    console.log(formatSqlResultsText(results, options.root));
  }
}

function printSqlHelp(): void {
  console.log(`
rr sql - Extract and list SQL queries from ORM code

USAGE:
  rr sql --drizzle [OPTIONS] [FILES...]

DESCRIPTION:
  Analyzes your codebase to find all database queries written using an ORM
  and generates the equivalent SQL statements. This helps verify that your
  queries will work correctly against your database schema.

ORM OPTIONS (one required):
  --drizzle               Analyze Drizzle ORM queries

OPTIONS:
  -h, --help              Show this help message
  -f, --format <format>   Output format: text (default) or json
  -r, --root <path>       Project root directory (default: cwd)
  --drizzle-schema <path> Path to Drizzle schema file (auto-discovered by default)

EXAMPLES:
  # Extract all SQL queries from route files
  rr sql --drizzle

  # Extract queries from a specific file
  rr sql --drizzle app/routes/users.tsx

  # Specify schema file explicitly
  rr sql --drizzle --drizzle-schema src/db/schema.ts

  # Output as JSON for processing
  rr sql --drizzle --format json

  # Use a different project root
  rr sql --drizzle --root ./my-app
`);
}

// ============================================================================
// Analyze Command (default)
// ============================================================================

interface ParsedArgs extends CliOptions {
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const options: ParsedArgs = {
    files: [],
    checks: [],
    format: 'text',
    root: process.cwd(),
    help: false,
    version: false,
    fix: false,
    dryRun: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      i++;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      options.version = true;
      i++;
      continue;
    }

    if (arg === '--fix') {
      options.fix = true;
      i++;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      i++;
      continue;
    }

    if (arg === '--format' || arg === '-f') {
      const value = args[i + 1];
      if (value === 'json' || value === 'text') {
        options.format = value;
      }
      i += 2;
      continue;
    }

    if (arg === '--check' || arg === '-c') {
      const value = args[i + 1];
      if (value) {
        if (value === 'all') {
          options.checks = [...ALL_CHECKS];
        } else {
          options.checks = value.split(',').map((c) => c.trim());
        }
      }
      i += 2;
      continue;
    }

    if (arg === '--root' || arg === '-r') {
      const value = args[i + 1];
      if (value) {
        options.root = path.resolve(value);
      }
      i += 2;
      continue;
    }

    if (arg === '--drizzle-schema') {
      const value = args[i + 1];
      if (value) {
        options.drizzleSchemaPath = path.resolve(value);
      }
      i += 2;
      continue;
    }

    // Positional argument - file to check
    if (!arg.startsWith('-')) {
      options.files.push(arg);
    }

    i++;
  }

  return options;
}

function printHelp(): void {
  console.log(`
rr - Static analysis and functional verification for React Router applications

USAGE:
  rr [OPTIONS] [FILES...]
  rr <command> [OPTIONS] [FILES...]

COMMANDS:
  sql                     Extract SQL queries from ORM code (use 'rr sql --help' for details)

OPTIONS:
  -h, --help              Show this help message
  -v, --version           Show version number
  -f, --format <format>   Output format: text (default) or json
  -c, --check <checks>    Comma-separated list of checks to run, or "all"
                          Default: links, loader, params, interactivity
                          Optional: forms, hydration, drizzle
  -r, --root <path>       Project root directory containing the app/ folder (default: cwd)
  --fix                   Automatically fix issues where possible
  --dry-run               Show what would be fixed without modifying files
  --drizzle-schema <path> Path to Drizzle schema file (for drizzle check, auto-discovered by default)

EXAMPLES:
  # Check all files in current directory (runs default checks)
  rr

  # Check specific file(s)
  rr app/routes/employees.tsx

  # Run only link and form checks
  rr --check links,forms

  # Run all checks (including optional ones)
  rr --check all

  # Output as JSON
  rr --format json

  # Automatically fix all fixable issues
  rr --fix

  # Preview fixes without applying
  rr --dry-run

  # Fix specific file(s)
  rr --fix app/routes/dashboard.tsx

  # Analyze files in a different project directory
  rr --root ./my-app ./my-app/app/routes/dashboard.tsx

  # Run the Drizzle ORM check (auto-discovers schema)
  rr --check drizzle

  # Drizzle check with explicit schema path
  rr --check drizzle --drizzle-schema src/db/schema.ts

  # Extract SQL queries from your Drizzle codebase
  rr sql --drizzle

  # Extract SQL queries in JSON format
  rr sql --drizzle --format json
`);
}

function printFixOutput(fixResult: FixResult, dryRun: boolean): void {
  const { fixedIssues, unfixableIssues, filesModified, errors } = fixResult;

  if (fixedIssues.length === 0 && unfixableIssues.length === 0) {
    console.log('No issues found.');
    return;
  }

  // Print fixed/would-fix issues
  if (fixedIssues.length > 0) {
    const action = dryRun ? 'Would fix' : 'Fixed';
    console.log(
      `\n${action} ${fixedIssues.length} issue${fixedIssues.length === 1 ? '' : 's'} in ${filesModified.length} file${filesModified.length === 1 ? '' : 's'}:`
    );
    console.log();

    for (const issue of fixedIssues) {
      const icon = issue.severity === 'error' ? '[error]' : '[warning]';
      const relativePath = path.relative(process.cwd(), issue.location.file);
      const fixLabel = dryRun ? '[would fix]' : '[fixed]';

      console.log(
        `[${issue.category}] ${relativePath}:${issue.location.line}:${issue.location.column}`
      );
      if (issue.code) {
        console.log(`  ${issue.code}`);
      }
      console.log(`  ${icon} ${issue.message}`);
      if (issue.fix) {
        console.log(`  ${fixLabel} ${issue.fix.description}`);
      }
      console.log();
    }
  }

  // Print errors that occurred while fixing
  if (errors.length > 0) {
    console.log('Errors while applying fixes:');
    for (const { file, error } of errors) {
      const relativePath = path.relative(process.cwd(), file);
      console.log(`  [!] ${relativePath}: ${error}`);
    }
    console.log();
  }

  // Print unfixable issues
  if (unfixableIssues.length > 0) {
    const errorCount = unfixableIssues.filter(
      (i) => i.severity === 'error'
    ).length;
    const warningCount = unfixableIssues.filter(
      (i) => i.severity === 'warning'
    ).length;

    console.log(
      `${unfixableIssues.length} issue${unfixableIssues.length === 1 ? '' : 's'} could not be auto-fixed:`
    );
    console.log();

    for (const issue of unfixableIssues) {
      const icon = issue.severity === 'error' ? '[error]' : '[warning]';
      const relativePath = path.relative(process.cwd(), issue.location.file);

      console.log(
        `[${issue.category}] ${relativePath}:${issue.location.line}:${issue.location.column}`
      );
      if (issue.code) {
        console.log(`  ${issue.code}`);
      }
      console.log(`  ${icon} ${issue.message}`);
      if (issue.suggestion) {
        console.log(`  -> ${issue.suggestion}`);
      }
      console.log();
    }

    console.log(
      `Unfixable: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`
    );
  }

  if (dryRun && fixedIssues.length > 0) {
    console.log('Run with --fix to apply changes.');
  }
}

main();
