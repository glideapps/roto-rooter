import * as path from 'path';
import type { AnalyzerIssue, AnalyzerResult } from '../types.js';

/**
 * JSON output for a single issue
 */
export interface JsonIssue {
  category: AnalyzerIssue['category'];
  severity: AnalyzerIssue['severity'];
  message: string;
  file: string;
  line: number;
  column: number;
  code?: string;
  suggestion?: string;
}

/**
 * JSON output structure for the analyzer
 */
export interface JsonOutput {
  issues: JsonIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
  };
}

/**
 * Format a single issue for JSON output
 */
export function formatIssueJson(
  issue: AnalyzerIssue,
  cwd: string = process.cwd()
): JsonIssue {
  const relativePath = path.relative(cwd, issue.location.file);

  const jsonIssue: JsonIssue = {
    category: issue.category,
    severity: issue.severity,
    message: issue.message,
    file: relativePath,
    line: issue.location.line,
    column: issue.location.column,
  };

  if (issue.code) {
    jsonIssue.code = issue.code;
  }

  if (issue.suggestion) {
    jsonIssue.suggestion = issue.suggestion;
  }

  return jsonIssue;
}

/**
 * Format analyzer result for JSON output
 *
 * This provides a stable, documented structure for JSON consumers,
 * separate from the internal AnalyzerResult structure.
 */
export function formatResultJson(
  result: AnalyzerResult,
  cwd: string = process.cwd()
): JsonOutput {
  const issues = result.issues.map((issue) => formatIssueJson(issue, cwd));
  const errors = result.issues.filter((i) => i.severity === 'error').length;
  const warnings = result.issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    summary: {
      total: result.issues.length,
      errors,
      warnings,
    },
  };
}
