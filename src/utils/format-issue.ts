import * as path from 'path';
import type { AnalyzerIssue } from '../types.js';

/**
 * Format a single issue for CLI output
 *
 * Format:
 * [severity] filename:line:column
 *   code
 *   x message
 *   -> suggestion
 */
export function formatIssue(
  issue: AnalyzerIssue,
  cwd: string = process.cwd()
): string {
  const lines: string[] = [];
  const relativePath = path.relative(cwd, issue.location.file);
  const filename = path.basename(relativePath);

  // Header: [severity] filename:line:column
  lines.push(
    `[${issue.severity}] ${filename}:${issue.location.line}:${issue.location.column}`
  );

  // Code snippet (indented)
  if (issue.code) {
    lines.push(`  ${issue.code}`);
  }

  // Message with x prefix (indented)
  lines.push(`  x ${issue.message}`);

  // Suggestion with -> prefix (indented)
  if (issue.suggestion) {
    lines.push(`  -> ${issue.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Format multiple issues for CLI output
 */
export function formatIssues(
  issues: AnalyzerIssue[],
  cwd: string = process.cwd()
): string {
  if (issues.length === 0) {
    return 'No issues found.';
  }

  const lines: string[] = [];

  // Header
  lines.push(
    `\nrr found ${issues.length} issue${issues.length === 1 ? '' : 's'}:`
  );
  lines.push('');

  // Each issue
  for (const issue of issues) {
    lines.push(formatIssue(issue, cwd));
    lines.push('');
  }

  // Summary
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  lines.push(
    `Summary: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`
  );
  lines.push('Run with --help for options.');

  return lines.join('\n');
}
