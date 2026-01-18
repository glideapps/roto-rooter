import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseRoutes, matchRoute } from '../src/parsers/route-parser.js';
import { parseComponent } from '../src/parsers/component-parser.js';
import { checkLinks } from '../src/checks/link-check.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('link-check', () => {
  it('should detect invalid link targets', () => {
    const routes = parseRoutes(fixturesDir);
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const component = parseComponent(dashboardPath);

    const issues = checkLinks([component], routes);

    // Should find the typo link "/employeees"
    expect(issues.some((i) => i.code?.includes('/employeees'))).toBe(true);
  });

  it('should not flag valid links', () => {
    const routes = parseRoutes(fixturesDir);
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const component = parseComponent(dashboardPath);

    const issues = checkLinks([component], routes);

    // Should NOT flag the valid links
    expect(issues.some((i) => i.code?.includes('"/employees"'))).toBe(false);
    expect(issues.some((i) => i.code?.includes('"/tasks"'))).toBe(false);
  });

  it('should validate dynamic link patterns', () => {
    const routes = parseRoutes(fixturesDir);
    const employeesPath = path.join(fixturesDir, 'app/routes/employees.tsx');
    const component = parseComponent(employeesPath);

    const issues = checkLinks([component], routes);

    // Dynamic link `/employees/${emp.id}` should be valid
    expect(issues).toHaveLength(0);
  });

  it('should suggest corrections for typos', () => {
    const routes = parseRoutes(fixturesDir);
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const component = parseComponent(dashboardPath);

    const issues = checkLinks([component], routes);
    const typoIssue = issues.find((i) => i.code?.includes('/employeees'));

    expect(typoIssue?.suggestion).toContain('/employees');
  });

  it('should match routes with query strings', () => {
    const routes = parseRoutes(fixturesDir);

    // URL with query string should match the base route
    const match = matchRoute('/employees?status=active', routes);
    expect(match).toBeDefined();
    expect(match?.path).toBe('/employees');
  });

  it('should match routes with hash fragments', () => {
    const routes = parseRoutes(fixturesDir);

    // URL with hash fragment should match the base route
    const match = matchRoute('/employees#section1', routes);
    expect(match).toBeDefined();
    expect(match?.path).toBe('/employees');
  });

  it('should match routes with both query string and hash', () => {
    const routes = parseRoutes(fixturesDir);

    // URL with both query string and hash should match the base route
    const match = matchRoute('/employees?status=active#section1', routes);
    expect(match).toBeDefined();
    expect(match?.path).toBe('/employees');
  });

  it('should not flag links with query strings in fixture', () => {
    const routes = parseRoutes(fixturesDir);
    const queryLinksPath = path.join(fixturesDir, 'app/routes/query-links.tsx');
    const component = parseComponent(queryLinksPath);

    const issues = checkLinks([component], routes);

    // All links in query-links.tsx should be valid (base paths exist)
    expect(issues).toHaveLength(0);
  });
});
