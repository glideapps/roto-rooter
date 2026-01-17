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
});
