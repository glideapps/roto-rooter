import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseComponent } from '../src/parsers/component-parser.js';
import { checkHydration } from '../src/checks/hydration-check.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('hydration-check', () => {
  describe('detecting hydration issues', () => {
    it('should detect new Date() in render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const dateIssues = issues.filter((i) =>
        i.message.includes('Date created during render')
      );
      expect(dateIssues.length).toBeGreaterThan(0);
    });

    it('should detect Date.now() in render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const dateNowIssues = issues.filter((i) =>
        i.code?.includes('Date.now()')
      );
      expect(dateNowIssues.length).toBeGreaterThan(0);
    });

    it('should detect toLocaleString without timezone', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const localeIssues = issues.filter((i) =>
        i.message.includes('Locale-dependent formatting')
      );
      expect(localeIssues.length).toBeGreaterThan(0);
    });

    it('should detect Math.random() in render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const randomIssues = issues.filter((i) =>
        i.message.includes('Random value')
      );
      expect(randomIssues.length).toBeGreaterThan(0);
    });

    it('should detect uuid() in render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const uuidIssues = issues.filter((i) => i.code?.includes('uuid()'));
      expect(uuidIssues.length).toBeGreaterThan(0);
    });

    it('should detect window access in render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const windowIssues = issues.filter((i) =>
        i.message.includes('Browser-only API')
      );
      expect(windowIssues.length).toBeGreaterThan(0);
    });

    it('should detect localStorage access in render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const storageIssues = issues.filter((i) =>
        i.code?.includes('localStorage')
      );
      expect(storageIssues.length).toBeGreaterThan(0);
    });
  });

  describe('allowing safe patterns', () => {
    it('should not flag date operations in useEffect', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-safe.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // The safe file should have minimal or no issues
      // It uses useEffect and suppressHydrationWarning
      const dateInEffectIssues = issues.filter(
        (i) => i.code?.includes('setClientTime') || i.code?.includes('setWidth')
      );
      expect(dateInEffectIssues).toHaveLength(0);
    });

    it('should not flag elements with suppressHydrationWarning', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-safe.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // suppressHydrationWarning elements should not trigger issues
      // The <time> element uses it
      const suppressedIssues = issues.filter(
        (i) =>
          i.location.line >= 30 && // After the useEffect
          i.code?.includes('toISOString')
      );
      expect(suppressedIssues).toHaveLength(0);
    });

    it('should not flag locale formatting with explicit timezone', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-safe.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // The safeFormatted variable uses timeZone option
      const safeFormattedIssues = issues.filter((i) =>
        i.code?.includes("timeZone: 'UTC'")
      );
      expect(safeFormattedIssues).toHaveLength(0);
    });

    it('should not flag Date operations in loader function', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/server-dates.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Loader runs server-side only, so no hydration issues
      expect(issues).toHaveLength(0);
    });

    it('should not flag Date operations in action function', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/server-dates.tsx'
      );
      const component = parseComponent(componentPath);

      // Verify the component has loader and action
      expect(component.hasLoader).toBe(true);
      expect(component.hasAction).toBe(true);

      // No hydration risks should be detected since all Date ops are in server functions
      expect(component.hydrationRisks).toHaveLength(0);
    });
  });

  describe('error deduplication', () => {
    it('should deduplicate locale-format containing date-render', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 1: new Date(data.date).toLocaleDateString()
      // Should only report locale-format, not date-render
      const line16Issues = issues.filter((i) => i.location.line === 16);
      expect(line16Issues).toHaveLength(1);
      expect(line16Issues[0].message).toContain('Locale-dependent formatting');
    });

    it('should deduplicate nested date-render errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 2: new Date(new Date().setHours(0, 0, 0, 0))
      // The outer new Date(...) should suppress the inner new Date()
      // Line 20: const isToday = new Date(data.date) >= new Date(new Date().setHours(...))
      // We expect 3 errors for date-render on line 20:
      // - new Date(data.date) at the start
      // - new Date(new Date().setHours(0,0,0,0)) which contains and suppresses inner new Date()
      const line20Issues = issues.filter((i) => i.location.line === 20);
      // Should be 2 errors: one for new Date(data.date), one for outer new Date(...)
      expect(line20Issues).toHaveLength(2);
      expect(
        line20Issues.every((i) =>
          i.message.includes('Date created during render')
        )
      ).toBe(true);
    });

    it('should not deduplicate separate date-render errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 3: Separate new Date() on lines 24 and 25
      // Should report 2 separate errors
      const line24Issues = issues.filter((i) => i.location.line === 24);
      const line25Issues = issues.filter((i) => i.location.line === 25);
      expect(line24Issues).toHaveLength(1);
      expect(line25Issues).toHaveLength(1);
    });

    it('should not deduplicate separate locale-format errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 4: Multiple locale calls on lines 30, 31, 32
      // Plus the new Date() on line 29 (since it's not contained in locale calls)
      const line29Issues = issues.filter((i) => i.location.line === 29);
      const line30Issues = issues.filter((i) => i.location.line === 30);
      const line31Issues = issues.filter((i) => i.location.line === 31);
      const line32Issues = issues.filter((i) => i.location.line === 32);

      // Line 29: new Date() - date-render error
      expect(line29Issues).toHaveLength(1);
      expect(line29Issues[0].message).toContain('Date created during render');
      // Lines 30-32: separate locale-format errors
      expect(line30Issues).toHaveLength(1);
      expect(line31Issues).toHaveLength(1);
      expect(line32Issues).toHaveLength(1);
    });
  });

  describe('issue severity', () => {
    it('should mark random values as errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const randomIssues = issues.filter((i) =>
        i.message.includes('Random value')
      );
      expect(randomIssues.every((i) => i.severity === 'error')).toBe(true);
    });

    it('should mark browser API access as errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const browserApiIssues = issues.filter((i) =>
        i.message.includes('Browser-only API')
      );
      expect(browserApiIssues.every((i) => i.severity === 'error')).toBe(true);
    });

    it('should mark date formatting as errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const dateIssues = issues.filter(
        (i) =>
          i.message.includes('Date created') ||
          i.message.includes('Locale-dependent')
      );
      expect(dateIssues.every((i) => i.severity === 'error')).toBe(true);
    });
  });
});
