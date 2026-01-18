import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseRoutes } from '../src/parsers/route-parser.js';
import { parseComponent } from '../src/parsers/component-parser.js';
import { checkForms } from '../src/checks/form-check.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('form-check', () => {
  it('should detect forms without action export', () => {
    const routes = parseRoutes(fixturesDir);
    const tasksPath = path.join(fixturesDir, 'app/routes/tasks.tsx');
    const component = parseComponent(tasksPath);

    const issues = checkForms([component], routes, fixturesDir);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('no action export');
  });

  it('should not flag forms with action export', () => {
    const routes = parseRoutes(fixturesDir);
    const employeeDetailPath = path.join(
      fixturesDir,
      'app/routes/employees.$id.tsx'
    );
    const component = parseComponent(employeeDetailPath);

    const issues = checkForms([component], routes, fixturesDir);

    expect(issues).toHaveLength(0);
  });

  describe('form field validation', () => {
    it('should detect when action reads a field not provided by the form', () => {
      const routes = parseRoutes(fixturesDir);
      const contactPath = path.join(fixturesDir, 'app/routes/contact.tsx');
      const component = parseComponent(contactPath);

      const issues = checkForms([component], routes, fixturesDir);

      const missingFieldError = issues.find(
        (i) =>
          i.severity === 'error' &&
          i.message.includes("'subject'") &&
          i.message.includes('no input')
      );
      expect(missingFieldError).toBeDefined();
      expect(missingFieldError?.suggestion).toContain('subject');
    });

    it('should warn when form provides a field the action never reads', () => {
      const routes = parseRoutes(fixturesDir);
      const contactPath = path.join(fixturesDir, 'app/routes/contact.tsx');
      const component = parseComponent(contactPath);

      const issues = checkForms([component], routes, fixturesDir);

      const unusedFieldWarning = issues.find(
        (i) =>
          i.severity === 'warning' &&
          i.message.includes("'name'") &&
          i.message.includes('never read')
      );
      expect(unusedFieldWarning).toBeDefined();
    });

    it('should not flag forms where all fields match', () => {
      const routes = parseRoutes(fixturesDir);
      const feedbackPath = path.join(fixturesDir, 'app/routes/feedback.tsx');
      const component = parseComponent(feedbackPath);

      const issues = checkForms([component], routes, fixturesDir);

      expect(issues).toHaveLength(0);
    });
  });

  describe('intent-based dispatch', () => {
    it('should validate forms against their specific intent fields only', () => {
      const routes = parseRoutes(fixturesDir);
      const intentDispatchPath = path.join(
        fixturesDir,
        'app/routes/intent-dispatch.tsx'
      );
      const component = parseComponent(intentDispatchPath);

      const issues = checkForms([component], routes, fixturesDir);

      // Should have no errors because each form only needs its intent-specific fields
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should extract intent value from submit buttons with name=intent', () => {
      const intentDispatchPath = path.join(
        fixturesDir,
        'app/routes/intent-dispatch.tsx'
      );
      const component = parseComponent(intentDispatchPath);

      // Check that intent values were extracted
      const createForm = component.forms.find(
        (f) => f.intentValue === 'create'
      );
      const deleteForm = component.forms.find(
        (f) => f.intentValue === 'delete'
      );
      const completeForm = component.forms.find(
        (f) => f.intentValue === 'complete'
      );

      expect(createForm).toBeDefined();
      expect(deleteForm).toBeDefined();
      expect(completeForm).toBeDefined();
    });
  });
});
