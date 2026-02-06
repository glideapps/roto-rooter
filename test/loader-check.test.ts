import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseComponent } from '../src/parsers/component-parser.js';
import { checkLoaders } from '../src/checks/loader-check.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('loader-check', () => {
  it('should detect useLoaderData without loader export', () => {
    const tasksPath = path.join(fixturesDir, 'app/routes/tasks.tsx');
    const component = parseComponent(tasksPath);

    const issues = checkLoaders([component]);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('useLoaderData');
    expect(issues[0].message).toContain('no loader');
  });

  it('should not flag components with matching loader', () => {
    const employeesPath = path.join(fixturesDir, 'app/routes/employees.tsx');
    const component = parseComponent(employeesPath);

    const issues = checkLoaders([component]);

    expect(issues).toHaveLength(0);
  });

  it('should detect clientLoader with server-only imports', () => {
    const filePath = path.join(fixturesDir, 'app/routes/client-loader-db.tsx');
    const component = parseComponent(filePath);

    expect(component.hasClientLoader).toBe(true);
    expect(component.serverImports).toContain('drizzle-orm');

    const issues = checkLoaders([component]);

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('clientLoader');
    expect(issues[0].message).toContain('server-only');
    expect(issues[0].message).toContain('drizzle-orm');
    expect(issues[0].suggestion).toContain('Rename clientLoader to loader');
  });

  it('should provide auto-fix to rename clientLoader to loader', () => {
    const filePath = path.join(fixturesDir, 'app/routes/client-loader-db.tsx');
    const component = parseComponent(filePath);

    const issues = checkLoaders([component]);

    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toBeDefined();
    expect(issues[0].fix!.edits).toHaveLength(1);
    expect(issues[0].fix!.edits[0].newText).toBe('loader');
  });

  it('should not flag clientLoader without server imports', () => {
    const filePath = path.join(
      fixturesDir,
      'app/routes/client-loader-safe.tsx'
    );
    const component = parseComponent(filePath);

    expect(component.hasClientLoader).toBe(true);
    expect(component.serverImports).toHaveLength(0);

    const issues = checkLoaders([component]);

    expect(issues).toHaveLength(0);
  });

  it('should not flag useLoaderData when clientLoader exists', () => {
    const filePath = path.join(
      fixturesDir,
      'app/routes/client-loader-safe.tsx'
    );
    const component = parseComponent(filePath);

    // Has clientLoader but no loader -- useLoaderData should still be valid
    expect(component.hasClientLoader).toBe(true);
    expect(component.hasLoader).toBe(false);
    expect(component.dataHooks.some((h) => h.hook === 'useLoaderData')).toBe(
      true
    );

    const issues = checkLoaders([component]);

    // Should not flag "useLoaderData without loader"
    expect(issues.filter((i) => i.message.includes('no loader'))).toHaveLength(
      0
    );
  });
});
