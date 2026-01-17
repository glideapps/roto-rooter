import { describe, it, expect } from 'vitest';
import { formatIssue, formatIssues } from '../src/utils/format-issue.js';
import type { AnalyzerIssue } from '../src/types.js';

describe('formatIssue', () => {
  it('formats a basic issue', () => {
    const issue: AnalyzerIssue = {
      category: 'links',
      severity: 'error',
      message: 'Link target not found',
      location: {
        file: '/project/app/routes/test.tsx',
        line: 10,
        column: 5,
      },
    };

    const result = formatIssue(issue, '/project');

    expect(result).toBe(
      '[error] test.tsx:10:5\n' + '  x Link target not found'
    );
  });

  it('includes code when present', () => {
    const issue: AnalyzerIssue = {
      category: 'hydration',
      severity: 'warning',
      message: 'Date rendered without timezone',
      location: {
        file: '/project/app/components/time.tsx',
        line: 15,
        column: 8,
      },
      code: 'new Date().toLocaleString()',
    };

    const result = formatIssue(issue, '/project');

    expect(result).toBe(
      '[warning] time.tsx:15:8\n' +
        '  new Date().toLocaleString()\n' +
        '  x Date rendered without timezone'
    );
  });

  it('includes suggestion when present', () => {
    const issue: AnalyzerIssue = {
      category: 'links',
      severity: 'error',
      message: 'Invalid route',
      location: {
        file: '/project/app/routes/test.tsx',
        line: 10,
        column: 5,
      },
      suggestion: 'Did you mean /employees/:id?',
    };

    const result = formatIssue(issue, '/project');

    expect(result).toBe(
      '[error] test.tsx:10:5\n' +
        '  x Invalid route\n' +
        '  -> Did you mean /employees/:id?'
    );
  });

  it('includes all fields when present', () => {
    const issue: AnalyzerIssue = {
      category: 'links',
      severity: 'error',
      message: 'Invalid route',
      location: {
        file: '/project/app/routes/test.tsx',
        line: 10,
        column: 5,
      },
      code: '<Link to="/bad" />',
      suggestion: 'Did you mean /employees/:id?',
    };

    const result = formatIssue(issue, '/project');

    expect(result).toBe(
      '[error] test.tsx:10:5\n' +
        '  <Link to="/bad" />\n' +
        '  x Invalid route\n' +
        '  -> Did you mean /employees/:id?'
    );
  });
});

describe('formatIssues', () => {
  it('returns message for empty issues', () => {
    const result = formatIssues([], '/project');

    expect(result).toBe('No issues found.');
  });

  it('formats single issue with correct grammar', () => {
    const issues: AnalyzerIssue[] = [
      {
        category: 'links',
        severity: 'error',
        message: 'Error 1',
        location: { file: '/project/a.tsx', line: 1, column: 1 },
      },
    ];

    const result = formatIssues(issues, '/project');

    expect(result).toContain('rr found 1 issue:');
    expect(result).toContain('Summary: 1 error, 0 warnings');
  });

  it('formats multiple issues with correct counts', () => {
    const issues: AnalyzerIssue[] = [
      {
        category: 'links',
        severity: 'error',
        message: 'Error 1',
        location: { file: '/project/a.tsx', line: 1, column: 1 },
      },
      {
        category: 'hydration',
        severity: 'warning',
        message: 'Warning 1',
        location: { file: '/project/b.tsx', line: 2, column: 2 },
      },
      {
        category: 'forms',
        severity: 'error',
        message: 'Error 2',
        location: { file: '/project/c.tsx', line: 3, column: 3 },
      },
    ];

    const result = formatIssues(issues, '/project');

    expect(result).toContain('rr found 3 issues:');
    expect(result).toContain('Summary: 2 errors, 1 warning');
    expect(result).toContain('[error] a.tsx:1:1');
    expect(result).toContain('[warning] b.tsx:2:2');
    expect(result).toContain('[error] c.tsx:3:3');
  });

  it('includes help text', () => {
    const issues: AnalyzerIssue[] = [
      {
        category: 'links',
        severity: 'error',
        message: 'Error',
        location: { file: '/project/a.tsx', line: 1, column: 1 },
      },
    ];

    const result = formatIssues(issues, '/project');

    expect(result).toContain('Run with --help for options.');
  });
});
