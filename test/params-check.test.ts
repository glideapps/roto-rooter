import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseRoutes } from '../src/parsers/route-parser.js';
import { parseComponent } from '../src/parsers/component-parser.js';
import { checkParams } from '../src/checks/params-check.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('params-check', () => {
  it('should detect access to undefined route params', () => {
    const routes = parseRoutes(fixturesDir);
    const editPath = path.join(
      fixturesDir,
      'app/routes/employees.$id.edit.tsx'
    );
    const component = parseComponent(editPath);

    const issues = checkParams([component], routes, fixturesDir);

    // Should detect that invalidParam doesn't exist in the route
    expect(issues.some((i) => i.message.includes('invalidParam'))).toBe(true);
    expect(issues.some((i) => i.category === 'params')).toBe(true);
  });

  it('should not flag valid param access', () => {
    const routes = parseRoutes(fixturesDir);
    const detailPath = path.join(fixturesDir, 'app/routes/employees.$id.tsx');
    const component = parseComponent(detailPath);

    const issues = checkParams([component], routes, fixturesDir);

    // The id param is valid for this route
    expect(issues).toHaveLength(0);
  });

  it('should suggest available params when invalid param is accessed', () => {
    const routes = parseRoutes(fixturesDir);
    const editPath = path.join(
      fixturesDir,
      'app/routes/employees.$id.edit.tsx'
    );
    const component = parseComponent(editPath);

    const issues = checkParams([component], routes, fixturesDir);
    const invalidIssue = issues.find((i) => i.message.includes('invalidParam'));

    expect(invalidIssue?.suggestion).toContain(':id');
  });
});
