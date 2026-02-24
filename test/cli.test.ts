import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const cliPath = path.join(distDir, 'cli.js');
const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

function runCli(args: string[]): {
  stdout: string;
  stderr: string;
  status: number;
} {
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    cwd: rootDir,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 1,
  };
}

describe('cli build', () => {
  it('should produce a runnable bundle', () => {
    // Run a fresh build
    execSync('npm run build', { cwd: rootDir, stdio: 'pipe' });

    // Verify the CLI bundle exists
    expect(fs.existsSync(cliPath)).toBe(true);

    // Verify it's executable by spawning it
    const result = spawnSync('node', [cliPath, '-v'], {
      encoding: 'utf-8',
      cwd: rootDir,
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should bundle all dependencies (no external requires)', () => {
    const cliContent = fs.readFileSync(cliPath, 'utf-8');

    // Should not have unresolved requires to our deps (they should be inlined)
    // Note: there will be require calls, but they should be to Node builtins only
    expect(cliContent).not.toContain('require("typescript")');
    expect(cliContent).not.toContain('require("fastest-levenshtein")');
  });
});

describe('cli', () => {
  beforeAll(() => {
    // Ensure the build exists
    if (!fs.existsSync(cliPath)) {
      execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
    }
  });

  it('should output version with -v flag', () => {
    const { stdout, status } = runCli(['-v']);
    expect(status).toBe(0);
    // Version should be a semver-like string
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should output help with -h flag', () => {
    const { stdout, status } = runCli(['-h']);
    expect(status).toBe(0);
    expect(stdout).toContain('rr - Static analysis');
    expect(stdout).toContain('USAGE:');
    expect(stdout).toContain('OPTIONS:');
  });

  it('should analyze files and find issues', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stdout, status } = runCli(['--root', fixturesDir, dashboardPath]);

    // Should exit with error code because there are issues
    expect(status).toBe(1);
    // Should find the typo link
    expect(stdout).toContain('/employeees');
  });

  it('should output JSON with --format json', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stdout, status } = runCli([
      '--root',
      fixturesDir,
      '--format',
      'json',
      dashboardPath,
    ]);

    expect(status).toBe(1);
    const output = JSON.parse(stdout);
    expect(output).toHaveProperty('issues');
    expect(Array.isArray(output.issues)).toBe(true);
    expect(output.issues.length).toBeGreaterThan(0);
  });

  it('should run specific checks with --check flag', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stdout: linksOnly } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'links',
      '--format',
      'json',
      dashboardPath,
    ]);

    const output = JSON.parse(linksOnly);
    // All issues should be from link check
    expect(output.issues.length).toBeGreaterThan(0);
    for (const issue of output.issues) {
      expect(issue.category).toBe('links');
    }
  });

  it('should warn about unknown check names', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stderr, status } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'foo',
      dashboardPath,
    ]);

    expect(stderr).toContain('Unknown check "foo"');
    expect(stderr).toContain('Valid checks:');
    // No valid checks ran, no issues found -> exit 0
    expect(status).toBe(0);
  });

  it('should suggest similar check names for typos', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stderr } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'link',
      dashboardPath,
    ]);

    expect(stderr).toContain('Did you mean "links"');
  });

  it('should warn about unknown checks but still run valid ones', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stdout, stderr, status } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'links,bogus',
      '--format',
      'json',
      dashboardPath,
    ]);

    expect(stderr).toContain('Unknown check "bogus"');

    const output = JSON.parse(stdout);
    expect(output.issues.length).toBeGreaterThan(0);
    for (const issue of output.issues) {
      expect(issue.category).toBe('links');
    }
    expect(status).toBe(1);
  });

  it('should not warn for valid check names and aliases', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');

    const { stderr: defaultsStderr } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'defaults',
      dashboardPath,
    ]);
    expect(defaultsStderr).not.toContain('Unknown check');

    const { stderr: allStderr } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'all',
      dashboardPath,
    ]);
    expect(allStderr).not.toContain('Unknown check');

    const { stderr: drizzleStderr } = runCli([
      '--root',
      fixturesDir,
      '--check',
      'defaults,drizzle',
      dashboardPath,
    ]);
    expect(drizzleStderr).not.toContain('Unknown check');
  });

  it('should warn about unknown CLI flags', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stderr } = runCli([
      '--root',
      fixturesDir,
      '--bogus',
      dashboardPath,
    ]);

    expect(stderr).toContain('Unknown option "--bogus"');
  });

  it('should treat everything after -- as file arguments', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stdout, stderr, status } = runCli([
      '--root',
      fixturesDir,
      '--format',
      'json',
      '--',
      dashboardPath,
    ]);

    // -- should not cause unknown option warnings
    expect(stderr).not.toContain('Unknown option');
    // Should still analyze the file after --
    expect(status).toBe(1);
    const output = JSON.parse(stdout);
    expect(output.issues.length).toBeGreaterThan(0);
  });
});
