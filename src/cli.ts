#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyze } from './analyzer.js';
import { applyFixes } from './fixer.js';
import type { AnalyzerIssue, CliOptions, FixResult } from './types.js';

function getVersion(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

function main(): void {
  const args = process.argv.slice(2);
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
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTextOutput(result.issues);
  }

  // Exit with error code if there are issues
  const errorCount = result.issues.filter((i) => i.severity === 'error').length;
  if (errorCount > 0) {
    process.exit(1);
  }
}

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
        options.checks = value.split(',').map((c) => c.trim());
      }
      i += 2;
      continue;
    }

    if (arg === '--app' || arg === '-a') {
      const value = args[i + 1];
      if (value) {
        options.root = path.resolve(value);
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

OPTIONS:
  -h, --help              Show this help message
  -v, --version           Show version number
  -f, --format <format>   Output format: text (default) or json
  -c, --check <checks>    Comma-separated list of checks to run (default is all checks)
                          Available: links, forms, loader, params, hydration
  -a, --app <path>        Root directory of the app to roto-root (default: current directory)
  --fix                   Automatically fix issues where possible
  --dry-run               Show what would be fixed without modifying files

EXAMPLES:
  # Check all files in current directory
  rr

  # Check specific file(s)
  rr app/routes/employees.tsx

  # Run only link and form checks
  rr --check links,forms

  # Output as JSON
  rr --format json

  # Automatically fix all fixable issues
  rr --fix

  # Preview fixes without applying
  rr --dry-run

  # Fix specific file(s)
  rr --fix app/routes/dashboard.tsx

  # Analyze files in the context of a different app
  rr --app ./my-app ./my-app/app/routes/dashboard.tsx
`);
}

function printTextOutput(issues: AnalyzerIssue[]): void {
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  console.log(
    `\nrr found ${issues.length} issue${issues.length === 1 ? '' : 's'}:`
  );
  console.log();

  for (const issue of issues) {
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
    `Summary: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`
  );
  console.log('Run with --help for options.');
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
