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
    const { stdout, status } = runCli(['--app', fixturesDir, dashboardPath]);

    // Should exit with error code because there are issues
    expect(status).toBe(1);
    // Should find the typo link
    expect(stdout).toContain('/employeees');
  });

  it('should output JSON with --format json', () => {
    const dashboardPath = path.join(fixturesDir, 'app/routes/dashboard.tsx');
    const { stdout, status } = runCli([
      '--app',
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
      '--app',
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
});
