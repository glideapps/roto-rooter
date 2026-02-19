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
        i.message.includes('new Date() without arguments')
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

    it('should detect toLocaleDateString without timezone', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const dateFormatIssues = issues.filter((i) =>
        i.message.includes('Date formatting without explicit timeZone')
      );
      expect(dateFormatIssues.length).toBeGreaterThan(0);
    });

    it('should detect toLocaleString without fixed locale', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      const localeIssues = issues.filter((i) =>
        i.message.includes('Locale-dependent formatting may produce')
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
        i.message.includes('Browser-only API accessed during render')
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

    it('should not flag browser APIs in event handlers', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/event-handlers.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Event handlers like handleCall, handleText, handleEmail, handleShare
      // contain window.location and document.createElement but should not be flagged
      // because they only run on user interaction, not during render
      expect(issues).toHaveLength(0);
    });

    it('should not flag inline arrow functions in onClick handlers', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/event-handlers.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Inline: onClick={() => { window.location.href = '/home'; }}
      // Should not be flagged
      const inlineIssues = issues.filter((i) => i.code?.includes('/home'));
      expect(inlineIssues).toHaveLength(0);
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
      expect(line16Issues[0].message).toContain(
        'Date formatting without explicit timeZone'
      );
    });

    it('should not flag new Date(arg) but should flag inner new Date()', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 2: new Date(data.date) >= new Date(new Date().setHours(0, 0, 0, 0))
      // new Date(data.date) has args -> not flagged (deterministic)
      // new Date(new Date().setHours(...)) has args -> not flagged
      // inner new Date() has no args -> flagged as date-render
      const line21Issues = issues.filter((i) => i.location.line === 21);
      expect(line21Issues).toHaveLength(1);
      expect(line21Issues[0].message).toContain('new Date() without arguments');
    });

    it('should not deduplicate separate date-render errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 3: Separate new Date() on lines 25 and 26
      // Should report 2 separate errors
      const line25Issues = issues.filter((i) => i.location.line === 25);
      const line26Issues = issues.filter((i) => i.location.line === 26);
      expect(line25Issues).toHaveLength(1);
      expect(line26Issues).toHaveLength(1);
    });

    it('should not deduplicate separate locale-format errors', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-dedup.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      // Case 4: Multiple locale calls on lines 31, 32, 33
      // Plus the new Date() on line 30 (since it's not contained in locale calls)
      const line30Issues = issues.filter((i) => i.location.line === 30);
      const line31Issues = issues.filter((i) => i.location.line === 31);
      const line32Issues = issues.filter((i) => i.location.line === 32);
      const line33Issues = issues.filter((i) => i.location.line === 33);

      // Line 30: new Date() - date-render error
      expect(line30Issues).toHaveLength(1);
      expect(line30Issues[0].message).toContain('new Date() without arguments');
      // Lines 31-33: separate locale-format errors
      expect(line31Issues).toHaveLength(1);
      expect(line32Issues).toHaveLength(1);
      expect(line33Issues).toHaveLength(1);
    });
  });

  describe('issue severity', () => {
    it('should mark all hydration issues as warnings', () => {
      const componentPath = path.join(
        fixturesDir,
        'app/routes/hydration-issues.tsx'
      );
      const component = parseComponent(componentPath);
      const issues = checkHydration([component]);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    });
  });
});
