#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyze } from './analyzer.js';
import type { CliOptions } from './types.js';
import { formatIssues } from './utils/format-issue.js';

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

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatIssues(result.issues));
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
                          Available: links, forms, loader, params, interactive, a11y
  -a, --app <path>       Root directory of the app to roto-root (default: current directory)

EXAMPLES:
  # Check all files in current directory
  rr

  # Check specific file(s)
  rr app/routes/employees.tsx

  # Run only link and form checks
  rr --check links,forms

  # Output as JSON
  rr --format json

  # Analyze files in the context of a different app
  rr --app ./my-app ./my-app/app/routes/dashboard.tsx

  # Analyze a file against an app in a different location
  rr --app /path/to/app /some/other/path/component.tsx
`);
}

main();
