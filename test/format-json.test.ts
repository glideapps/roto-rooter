import { describe, it, expect } from 'vitest';
import {
  formatIssueJson,
  formatResultJson,
  type JsonOutput,
} from '../src/utils/format-json.js';
import type { AnalyzerIssue, AnalyzerResult } from '../src/types.js';

describe('formatIssueJson', () => {
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

    const result = formatIssueJson(issue, '/project');

    expect(result).toEqual({
      category: 'links',
      severity: 'error',
      message: 'Link target not found',
      file: 'app/routes/test.tsx',
      line: 10,
      column: 5,
    });
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

    const result = formatIssueJson(issue, '/project');

    expect(result.code).toBe('new Date().toLocaleString()');
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

    const result = formatIssueJson(issue, '/project');

    expect(result.suggestion).toBe('Did you mean /employees/:id?');
  });

  it('omits optional fields when not present', () => {
    const issue: AnalyzerIssue = {
      category: 'loader',
      severity: 'error',
      message: 'Missing loader',
      location: {
        file: '/project/app/routes/test.tsx',
        line: 1,
        column: 1,
      },
    };

    const result = formatIssueJson(issue, '/project');

    expect(result).not.toHaveProperty('code');
    expect(result).not.toHaveProperty('suggestion');
  });
});

describe('formatResultJson', () => {
  it('formats empty result', () => {
    const result: AnalyzerResult = {
      issues: [],
      routes: [],
      components: [],
    };

    const output = formatResultJson(result, '/project');

    expect(output).toEqual({
      issues: [],
      summary: {
        total: 0,
        errors: 0,
        warnings: 0,
      },
    });
  });

  it('formats result with mixed issues', () => {
    const result: AnalyzerResult = {
      issues: [
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
      ],
      routes: [],
      components: [],
    };

    const output = formatResultJson(result, '/project');

    expect(output.issues).toHaveLength(3);
    expect(output.summary).toEqual({
      total: 3,
      errors: 2,
      warnings: 1,
    });
  });

  it('excludes internal data structures (routes, components)', () => {
    const result: AnalyzerResult = {
      issues: [],
      routes: [
        {
          path: '/test',
          file: 'routes/test.tsx',
          params: [],
          pattern: /^\/test$/,
        },
      ],
      components: [
        {
          file: '/project/app/routes/test.tsx',
          links: [],
          forms: [],
          dataHooks: [],
          hydrationRisks: [],
          hasLoader: true,
          hasAction: false,
        },
      ],
    };

    const output = formatResultJson(result, '/project');

    // Internal structures should not be in output
    expect(output).not.toHaveProperty('routes');
    expect(output).not.toHaveProperty('components');
    // Only issues and summary should be present
    expect(Object.keys(output)).toEqual(['issues', 'summary']);
  });

  it('produces stable JSON output', () => {
    const result: AnalyzerResult = {
      issues: [
        {
          category: 'links',
          severity: 'error',
          message: 'Test error',
          location: { file: '/project/test.tsx', line: 5, column: 10 },
          code: '<Link to="/bad" />',
          suggestion: 'Use /good instead',
        },
      ],
      routes: [],
      components: [],
    };

    const output = formatResultJson(result, '/project');
    const json = JSON.stringify(output, null, 2);

    // Verify the JSON is well-formed and contains expected structure
    const parsed = JSON.parse(json) as JsonOutput;
    expect(parsed.issues[0].file).toBe('test.tsx');
    expect(parsed.summary.total).toBe(1);
  });
});
