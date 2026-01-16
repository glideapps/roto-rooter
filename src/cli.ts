#!/usr/bin/env node

import * as path from "path";
import { analyze } from "./analyzer.js";
import type { AnalyzerIssue, CliOptions } from "./types.js";

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const result = analyze(options);

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTextOutput(result.issues);
  }

  // Exit with error code if there are issues
  const errorCount = result.issues.filter((i) => i.severity === "error").length;
  if (errorCount > 0) {
    process.exit(1);
  }
}

interface ParsedArgs extends CliOptions {
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const options: ParsedArgs = {
    files: [],
    checks: [],
    format: "text",
    root: process.cwd(),
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      i++;
      continue;
    }

    if (arg === "--format" || arg === "-f") {
      const value = args[i + 1];
      if (value === "json" || value === "text") {
        options.format = value;
      }
      i += 2;
      continue;
    }

    if (arg === "--check" || arg === "-c") {
      const value = args[i + 1];
      if (value) {
        options.checks = value.split(",").map((c) => c.trim());
      }
      i += 2;
      continue;
    }

    if (arg === "--root" || arg === "-r") {
      const value = args[i + 1];
      if (value) {
        options.root = path.resolve(value);
      }
      i += 2;
      continue;
    }

    // Positional argument - file to check
    if (!arg.startsWith("-")) {
      options.files.push(arg);
    }

    i++;
  }

  return options;
}

function printHelp(): void {
  console.log(`
react-router-analyzer - Static analysis for React Router applications

USAGE:
  react-router-analyzer [OPTIONS] [FILES...]

OPTIONS:
  -h, --help              Show this help message
  -f, --format <format>   Output format: text (default) or json
  -c, --check <checks>    Comma-separated list of checks to run
                          Available: links, forms, loader, params, interactive, a11y
  -r, --root <path>       Root directory of the project (default: current directory)

EXAMPLES:
  # Check all files
  react-router-analyzer

  # Check specific file(s)
  react-router-analyzer app/routes/employees.tsx

  # Run only link and form checks
  react-router-analyzer --check links,forms

  # Output as JSON
  react-router-analyzer --format json

  # Set project root
  react-router-analyzer --root ./my-app
`);
}

function printTextOutput(issues: AnalyzerIssue[]): void {
  if (issues.length === 0) {
    console.log("✅ No issues found");
    return;
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  console.log(
    `\n❌ react-router-analyzer found ${issues.length} issue${issues.length === 1 ? "" : "s"}:`
  );
  console.log();

  for (const issue of issues) {
    const icon = issue.severity === "error" ? "❌" : "⚠️";
    const relativePath = path.relative(process.cwd(), issue.location.file);

    console.log(
      `[${issue.category}] ${relativePath}:${issue.location.line}:${issue.location.column}`
    );
    if (issue.code) {
      console.log(`  ${issue.code}`);
    }
    console.log(`  ${icon} ${issue.message}`);
    if (issue.suggestion) {
      console.log(`  💡 ${issue.suggestion}`);
    }
    console.log();
  }

  console.log(
    `Summary: ${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`
  );
  console.log("Run with --help for options.");
}

main();
