import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { analyze } from '../src/analyzer.js';
import { applyFixes } from '../src/fixer.js';

/**
 * End-to-end integration tests for the fix system.
 *
 * These tests verify the complete pipeline:
 * 1. Create fixture files with known issues
 * 2. Run analyze() to detect issues and generate fix spans
 * 3. Run applyFixes() to apply the fixes
 * 4. Run analyze() again to verify the issues are resolved
 * 5. Verify the file content is correct
 */
describe('fix integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-fix-integration-'));
    // Create app structure
    fs.mkdirSync(path.join(tempDir, 'app', 'routes'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeFile(relativePath: string, content: string): string {
    const fullPath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    return fullPath;
  }

  function readFile(relativePath: string): string {
    return fs.readFileSync(path.join(tempDir, relativePath), 'utf-8');
  }

  describe('link-check fixes', () => {
    it('should fix link typo and re-analysis finds no issues', () => {
      // Setup: routes.ts with /employees route
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/employees', 'routes/employees.tsx'),
] satisfies RouteConfig;`
      );

      // Setup: component with typo "/employeees" -> should be "/employees"
      writeFile(
        'app/routes/employees.tsx',
        `import { Link } from 'react-router';
export default function Employees() {
  return <Link to="/employeees">View</Link>;
}`
      );

      // Step 1: Analyze - should find the typo issue
      const result1 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result1.issues.length).toBe(1);
      expect(result1.issues[0].message).toContain('No matching route');
      expect(result1.issues[0].fix).toBeDefined();
      expect(result1.issues[0].fix?.description).toContain('/employees');

      // Step 2: Apply fix
      const fixResult = applyFixes(result1.issues, false);
      expect(fixResult.fixesApplied).toBe(1);
      expect(fixResult.errors).toHaveLength(0);

      // Step 3: Verify file content is correct
      const newContent = readFile('app/routes/employees.tsx');
      expect(newContent).toContain('to="/employees"');
      expect(newContent).not.toContain('to="/employeees"');

      // Step 4: Re-analyze - should find no issues
      const result2 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result2.issues).toHaveLength(0);
    });

    it('should fix anchor href typo and re-analysis finds no issues', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/tasks', 'routes/tasks.tsx'),
] satisfies RouteConfig;`
      );

      writeFile(
        'app/routes/tasks.tsx',
        `export default function Tasks() {
  return <a href="/taks">View Tasks</a>;
}`
      );

      // Analyze - should find the typo
      const result1 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result1.issues.length).toBe(1);
      expect(result1.issues[0].fix).toBeDefined();

      // Apply fix
      const fixResult = applyFixes(result1.issues, false);
      expect(fixResult.fixesApplied).toBe(1);

      // Verify content
      const newContent = readFile('app/routes/tasks.tsx');
      expect(newContent).toContain('href="/tasks"');

      // Re-analyze - no issues
      const result2 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result2.issues).toHaveLength(0);
    });
  });

  describe('form-check fixes', () => {
    it('should fix form action typo and re-analysis finds no issues', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/users', 'routes/users.tsx'),
  route('/submit', 'routes/submit.tsx'),
] satisfies RouteConfig;`
      );

      // Route with action export
      writeFile(
        'app/routes/submit.tsx',
        `export function action() { return null; }
export default function Submit() { return <div>Submit</div>; }`
      );

      // Form with typo action="/sumbit" -> should be "/submit"
      writeFile(
        'app/routes/users.tsx',
        `import { Form } from 'react-router';
export default function Users() {
  return <Form action="/sumbit"><button>Submit</button></Form>;
}`
      );

      // Analyze - should find the typo
      const result1 = analyze({ root: tempDir, files: [], checks: ['forms'] });
      const actionIssue = result1.issues.find((i) =>
        i.message.includes('non-existent route')
      );
      expect(actionIssue).toBeDefined();
      expect(actionIssue?.fix).toBeDefined();

      // Apply fix
      const fixResult = applyFixes(result1.issues, false);
      expect(fixResult.fixesApplied).toBeGreaterThanOrEqual(1);

      // Verify content
      const newContent = readFile('app/routes/users.tsx');
      expect(newContent).toContain('action="/submit"');

      // Re-analyze - no route typo issue
      const result2 = analyze({ root: tempDir, files: [], checks: ['forms'] });
      const routeIssue = result2.issues.find((i) =>
        i.message.includes('non-existent route')
      );
      expect(routeIssue).toBeUndefined();
    });
  });

  describe('params-check fixes', () => {
    it('should fix param name typo and re-analysis finds no issues', () => {
      // Route with :id param
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/users/:id', 'routes/users.$id.tsx'),
] satisfies RouteConfig;`
      );

      // Component accesses wrong param name "userId" -> should be "id"
      // Note: The fix only renames the binding, not the variable usage in JSX
      writeFile(
        'app/routes/users.$id.tsx',
        `import { useParams } from 'react-router';
export default function UserDetail() {
  const { userId } = useParams();
  return <div>User {userId}</div>;
}`
      );

      // Analyze - should find the param mismatch
      const result1 = analyze({ root: tempDir, files: [], checks: ['params'] });
      expect(result1.issues.length).toBe(1);
      expect(result1.issues[0].message).toContain('userId');
      expect(result1.issues[0].fix).toBeDefined();
      expect(result1.issues[0].fix?.description).toContain('id');

      // Apply fix
      const fixResult = applyFixes(result1.issues, false);
      expect(fixResult.fixesApplied).toBe(1);

      // Verify content - destructuring binding renamed to "id"
      // Note: variable usages elsewhere are NOT renamed (user must do that manually or use IDE refactor)
      const newContent = readFile('app/routes/users.$id.tsx');
      expect(newContent).toContain('{ id }');
      expect(newContent).toContain('const { id } = useParams()');

      // Re-analyze - no issues (params check only looks at destructuring)
      const result2 = analyze({ root: tempDir, files: [], checks: ['params'] });
      expect(result2.issues).toHaveLength(0);
    });

    it('should fix param typo using fuzzy match when multiple params exist', () => {
      // Route with multiple params
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/orgs/:orgId/users/:userId', 'routes/org-user.tsx'),
] satisfies RouteConfig;`
      );

      // Component has typo "usrId" -> should match "userId" via fuzzy matching
      // Note: only the destructuring binding is fixed, not JSX usages
      writeFile(
        'app/routes/org-user.tsx',
        `import { useParams } from 'react-router';
export default function OrgUser() {
  const { orgId, usrId } = useParams();
  return <div>Org {orgId} User {usrId}</div>;
}`
      );

      // Analyze
      const result1 = analyze({ root: tempDir, files: [], checks: ['params'] });
      const paramIssue = result1.issues.find((i) =>
        i.message.includes('usrId')
      );
      expect(paramIssue).toBeDefined();
      expect(paramIssue?.fix?.description).toContain('userId');

      // Apply fix
      applyFixes(result1.issues, false);

      // Verify content - destructuring binding is fixed
      const newContent = readFile('app/routes/org-user.tsx');
      expect(newContent).toContain('{ orgId, userId }');

      // Re-analyze - no issues (params check only looks at destructuring)
      const result2 = analyze({ root: tempDir, files: [], checks: ['params'] });
      expect(result2.issues).toHaveLength(0);
    });
  });

  describe('hydration-check fixes', () => {
    it('should not auto-fix ambiguous toLocaleString (could be Number or Date)', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/dates', 'routes/dates.tsx'),
] satisfies RouteConfig;`
      );

      // Component with toLocaleString() -- ambiguous, could be on Number or Date
      writeFile(
        'app/routes/dates.tsx',
        `export default function Dates() {
  const date = new Date('2024-01-01');
  return <div>{date.toLocaleString()}</div>;
}`
      );

      // Analyze - should find the locale format issue but no auto-fix
      const result1 = analyze({
        root: tempDir,
        files: [],
        checks: ['hydration'],
      });
      const localeIssue = result1.issues.find((i) =>
        i.message.includes('Locale-dependent formatting may produce')
      );
      expect(localeIssue).toBeDefined();
      expect(localeIssue?.fix).toBeUndefined();
    });

    it('should fix toLocaleDateString without timezone', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/dates', 'routes/dates.tsx'),
] satisfies RouteConfig;`
      );

      writeFile(
        'app/routes/dates.tsx',
        `export default function Dates() {
  const date = new Date('2024-01-01');
  return <div>{date.toLocaleDateString()}</div>;
}`
      );

      const result1 = analyze({
        root: tempDir,
        files: [],
        checks: ['hydration'],
      });
      const localeIssue = result1.issues.find((i) =>
        i.message.includes('Date formatting without explicit timeZone')
      );
      expect(localeIssue?.fix).toBeDefined();

      applyFixes(result1.issues, false);

      const newContent = readFile('app/routes/dates.tsx');
      expect(newContent).toContain(
        'toLocaleDateString(undefined, { timeZone: "UTC" })'
      );
    });

    it('should fix uuid() call with useId() and re-analysis finds no issues', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/ids', 'routes/ids.tsx'),
] satisfies RouteConfig;`
      );

      // Component with uuid() call
      writeFile(
        'app/routes/ids.tsx',
        `export default function Ids() {
  const id = uuid();
  return <div id={id}>Content</div>;
}`
      );

      // Analyze - should find the random value issue
      const result1 = analyze({
        root: tempDir,
        files: [],
        checks: ['hydration'],
      });
      const randomIssue = result1.issues.find((i) =>
        i.message.includes('Random value')
      );
      expect(randomIssue).toBeDefined();
      expect(randomIssue?.fix).toBeDefined();
      expect(randomIssue?.fix?.description).toContain('useId');

      // Apply fix
      applyFixes(result1.issues, false);

      // Verify content - uuid() replaced with useId()
      const newContent = readFile('app/routes/ids.tsx');
      expect(newContent).toContain('useId()');
      expect(newContent).not.toContain('uuid()');

      // Re-analyze - no random value issues from uuid
      const result2 = analyze({
        root: tempDir,
        files: [],
        checks: ['hydration'],
      });
      const randomIssue2 = result2.issues.find(
        (i) => i.message.includes('Random value') && i.code?.includes('uuid')
      );
      expect(randomIssue2).toBeUndefined();
    });

    it('should fix nanoid() call with useId()', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/ids', 'routes/ids.tsx'),
] satisfies RouteConfig;`
      );

      writeFile(
        'app/routes/ids.tsx',
        `export default function Ids() {
  const id = nanoid();
  return <div id={id}>Content</div>;
}`
      );

      const result1 = analyze({
        root: tempDir,
        files: [],
        checks: ['hydration'],
      });
      const randomIssue = result1.issues.find((i) =>
        i.code?.includes('nanoid')
      );
      expect(randomIssue?.fix).toBeDefined();

      applyFixes(result1.issues, false);

      const newContent = readFile('app/routes/ids.tsx');
      expect(newContent).toContain('useId()');
      expect(newContent).not.toContain('nanoid()');
    });
  });

  describe('multiple fixes in same file', () => {
    it('should apply multiple non-overlapping fixes correctly', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/users', 'routes/users.tsx'),
  route('/tasks', 'routes/tasks.tsx'),
] satisfies RouteConfig;`
      );

      // File with two link typos
      writeFile(
        'app/routes/users.tsx',
        `import { Link } from 'react-router';
export default function Users() {
  return (
    <div>
      <Link to="/usrs">Users</Link>
      <Link to="/taks">Tasks</Link>
    </div>
  );
}`
      );

      // Analyze - should find both typos
      const result1 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result1.issues.length).toBe(2);
      expect(result1.issues.every((i) => i.fix)).toBe(true);

      // Apply fixes
      const fixResult = applyFixes(result1.issues, false);
      expect(fixResult.fixesApplied).toBe(2);
      expect(fixResult.errors).toHaveLength(0);

      // Verify content - both fixed
      const newContent = readFile('app/routes/users.tsx');
      expect(newContent).toContain('to="/users"');
      expect(newContent).toContain('to="/tasks"');
      expect(newContent).not.toContain('to="/usrs"');
      expect(newContent).not.toContain('to="/taks"');

      // Re-analyze - no issues
      const result2 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result2.issues).toHaveLength(0);
    });
  });

  describe('loader-check fixes', () => {
    it('should fix clientLoader to loader and re-analysis finds no issues', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/boats', 'routes/boats.tsx'),
] satisfies RouteConfig;`
      );

      // Route with clientLoader that imports server-only module
      writeFile(
        'app/routes/boats.tsx',
        `import { useLoaderData } from 'react-router';
import { db } from '~/db';
import { boatsTable } from 'drizzle-orm';

export async function clientLoader() {
  const boats = await db.select().from(boatsTable);
  return { boats };
}

export default function Boats() {
  const { boats } = useLoaderData<typeof clientLoader>();
  return <div>{boats.length} boats</div>;
}`
      );

      // Analyze - should find clientLoader with server-only import
      const result1 = analyze({
        root: tempDir,
        files: [],
        checks: ['loader'],
      });
      const clientLoaderIssue = result1.issues.find((i) =>
        i.message.includes('clientLoader')
      );
      expect(clientLoaderIssue).toBeDefined();
      expect(clientLoaderIssue?.fix).toBeDefined();
      expect(clientLoaderIssue?.fix?.description).toContain('loader');

      // Apply fix
      const fixResult = applyFixes(result1.issues, false);
      expect(fixResult.fixesApplied).toBeGreaterThanOrEqual(1);

      // Verify content - clientLoader renamed to loader
      const newContent = readFile('app/routes/boats.tsx');
      expect(newContent).toContain('export async function loader()');
      expect(newContent).not.toContain('clientLoader()');

      // Re-analyze - no clientLoader issues
      const result2 = analyze({
        root: tempDir,
        files: [],
        checks: ['loader'],
      });
      const clientLoaderIssue2 = result2.issues.find((i) =>
        i.message.includes('clientLoader')
      );
      expect(clientLoaderIssue2).toBeUndefined();
    });
  });

  describe('dry-run mode', () => {
    it('should not modify files but report what would be fixed', () => {
      writeFile(
        'app/routes.ts',
        `import { type RouteConfig, route } from '@react-router/dev/routes';
export default [
  route('/employees', 'routes/employees.tsx'),
] satisfies RouteConfig;`
      );

      const originalContent = `import { Link } from 'react-router';
export default function Employees() {
  return <Link to="/employeees">View</Link>;
}`;
      writeFile('app/routes/employees.tsx', originalContent);

      // Analyze
      const result1 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result1.issues.length).toBe(1);
      expect(result1.issues[0].fix).toBeDefined();

      // Apply in dry-run mode
      const fixResult = applyFixes(result1.issues, true);
      expect(fixResult.fixesApplied).toBe(1);
      expect(fixResult.filesModified).toHaveLength(1);

      // File should NOT be modified
      const currentContent = readFile('app/routes/employees.tsx');
      expect(currentContent).toBe(originalContent);

      // Re-analyze should still find the issue
      const result2 = analyze({ root: tempDir, files: [], checks: ['links'] });
      expect(result2.issues.length).toBe(1);
    });
  });
});
