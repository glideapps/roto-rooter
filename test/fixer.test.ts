import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyFixes } from '../src/fixer.js';
import type { AnalyzerIssue } from '../src/types.js';

describe('fixer', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-fixer-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTempFile(name: string, content: string): string {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  describe('applyFixes', () => {
    it('should apply a single fix correctly', () => {
      const filePath = createTempFile(
        'test.tsx',
        '<Link to="/employeees">Test</Link>'
      );
      // Positions: <Link to="/employeees">
      //            0123456789...
      // The quoted value "/employeees" is at positions 9-21 (end exclusive: 22)

      const issues: AnalyzerIssue[] = [
        {
          category: 'links',
          severity: 'error',
          message: 'No matching route',
          location: { file: filePath, line: 1, column: 1 },
          code: 'href="/employeees"',
          fix: {
            description: 'Replaced "/employeees" with "/employees"',
            edits: [
              {
                file: filePath,
                start: 9, // Start of "
                end: 22, // After closing "
                newText: '"/employees"',
              },
            ],
          },
        },
      ];

      const result = applyFixes(issues, false);

      expect(result.fixesApplied).toBe(1);
      expect(result.filesModified).toContain(filePath);
      expect(result.unfixableIssues).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      const newContent = fs.readFileSync(filePath, 'utf-8');
      expect(newContent).toBe('<Link to="/employees">Test</Link>');
    });

    it('should apply multiple non-overlapping edits to the same file', () => {
      // Content: <Link to="/usrs">Users</Link>\n<Link to="/prods">Products</Link>
      // Line 1: <Link to="/usrs">  - "/usrs" at positions 9-15 (end: 16)
      // Line 2 starts at position 30 (after \n)
      // Line 2: <Link to="/prods"> - "/prods" at positions 39-46 (end: 47)
      const filePath = createTempFile(
        'test.tsx',
        '<Link to="/usrs">Users</Link>\n<Link to="/prods">Products</Link>'
      );

      const issues: AnalyzerIssue[] = [
        {
          category: 'links',
          severity: 'error',
          message: 'No matching route',
          location: { file: filePath, line: 1, column: 1 },
          fix: {
            description: 'Fix 1',
            edits: [{ file: filePath, start: 9, end: 16, newText: '"/users"' }],
          },
        },
        {
          category: 'links',
          severity: 'error',
          message: 'No matching route',
          location: { file: filePath, line: 2, column: 1 },
          fix: {
            description: 'Fix 2',
            edits: [
              { file: filePath, start: 39, end: 47, newText: '"/products"' },
            ],
          },
        },
      ];

      const result = applyFixes(issues, false);

      expect(result.fixesApplied).toBe(2);
      expect(result.filesModified).toHaveLength(1);

      const newContent = fs.readFileSync(filePath, 'utf-8');
      expect(newContent).toContain('"/users"');
      expect(newContent).toContain('"/products"');
    });

    it('should not modify files in dry-run mode', () => {
      const filePath = createTempFile(
        'test.tsx',
        '<Link to="/employeees">Test</Link>'
      );
      const originalContent = fs.readFileSync(filePath, 'utf-8');

      const issues: AnalyzerIssue[] = [
        {
          category: 'links',
          severity: 'error',
          message: 'No matching route',
          location: { file: filePath, line: 1, column: 1 },
          fix: {
            description: 'Replaced "/employeees" with "/employees"',
            edits: [
              { file: filePath, start: 9, end: 22, newText: '"/employees"' },
            ],
          },
        },
      ];

      const result = applyFixes(issues, true);

      expect(result.fixesApplied).toBe(1);
      expect(result.filesModified).toContain(filePath);

      // File should not be modified
      const currentContent = fs.readFileSync(filePath, 'utf-8');
      expect(currentContent).toBe(originalContent);
    });

    it('should separate fixable and unfixable issues', () => {
      const filePath = createTempFile('test.tsx', 'const x = 1;');

      const issues: AnalyzerIssue[] = [
        {
          category: 'links',
          severity: 'error',
          message: 'Fixable issue',
          location: { file: filePath, line: 1, column: 1 },
          fix: {
            description: 'Fix it',
            edits: [{ file: filePath, start: 0, end: 5, newText: 'let' }],
          },
        },
        {
          category: 'loader',
          severity: 'error',
          message: 'Unfixable issue',
          location: { file: filePath, line: 1, column: 1 },
          // No fix property
        },
      ];

      const result = applyFixes(issues, false);

      expect(result.fixesApplied).toBe(1);
      expect(result.fixedIssues).toHaveLength(1);
      expect(result.unfixableIssues).toHaveLength(1);
      expect(result.unfixableIssues[0].message).toBe('Unfixable issue');
    });

    it('should handle file read errors gracefully', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.tsx');

      const issues: AnalyzerIssue[] = [
        {
          category: 'links',
          severity: 'error',
          message: 'Issue',
          location: { file: nonExistentPath, line: 1, column: 1 },
          fix: {
            description: 'Fix it',
            edits: [
              { file: nonExistentPath, start: 0, end: 5, newText: 'test' },
            ],
          },
        },
      ];

      const result = applyFixes(issues, false);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe(nonExistentPath);
    });

    it('should detect overlapping edits', () => {
      const filePath = createTempFile('test.tsx', 'const x = 1;');

      const issues: AnalyzerIssue[] = [
        {
          category: 'links',
          severity: 'error',
          message: 'Issue 1',
          location: { file: filePath, line: 1, column: 1 },
          fix: {
            description: 'Fix 1',
            edits: [{ file: filePath, start: 0, end: 10, newText: 'let y' }],
          },
        },
        {
          category: 'links',
          severity: 'error',
          message: 'Issue 2',
          location: { file: filePath, line: 1, column: 5 },
          fix: {
            description: 'Fix 2',
            // Overlaps with previous edit
            edits: [{ file: filePath, start: 5, end: 12, newText: 'z = 2' }],
          },
        },
      ];

      const result = applyFixes(issues, false);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Overlapping');
    });
  });
});
