import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseRoutes } from '../src/parsers/route-parser.js';
import { parseComponent } from '../src/parsers/component-parser.js';
import { checkForms } from '../src/checks/form-check.js';
import { parseRouteExports } from '../src/parsers/action-parser.js';

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

    it('should not flag forms where all fields match', () => {
      const routes = parseRoutes(fixturesDir);
      const feedbackPath = path.join(fixturesDir, 'app/routes/feedback.tsx');
      const component = parseComponent(feedbackPath);

      const issues = checkForms([component], routes, fixturesDir);

      expect(issues).toHaveLength(0);
    });
  });

  describe('component-wrapped form inputs', () => {
    it('should detect PascalCase component inputs with name props', () => {
      const componentInputsPath = path.join(
        fixturesDir,
        'app/routes/component-inputs.tsx'
      );
      const component = parseComponent(componentInputsPath);

      // Should extract all input names from PascalCase components
      expect(component.forms).toHaveLength(1);
      const form = component.forms[0];

      // Check that all the component-wrapped inputs were detected
      expect(form.inputNames).toContain('firstName');
      expect(form.inputNames).toContain('lastName');
      expect(form.inputNames).toContain('email');
      expect(form.inputNames).toContain('bio');
      expect(form.inputNames).toContain('age');
      expect(form.inputNames).toContain('role');
      expect(form.inputNames).toContain('startDate');
      expect(form.inputNames).toContain('notifications');
    });

    it('should not flag forms using component wrappers when fields match', () => {
      const routes = parseRoutes(fixturesDir);
      const componentInputsPath = path.join(
        fixturesDir,
        'app/routes/component-inputs.tsx'
      );
      const component = parseComponent(componentInputsPath);

      const issues = checkForms([component], routes, fixturesDir);

      // Should have no errors since all fields match
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
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

    it('should not flag forms when fields are read at top level but only used in specific intents', () => {
      const routes = parseRoutes(fixturesDir);
      const intentTopLevelPath = path.join(
        fixturesDir,
        'app/routes/intent-toplevel.tsx'
      );
      const component = parseComponent(intentTopLevelPath);

      const issues = checkForms([component], routes, fixturesDir);

      // Should have no errors - delete and archive forms should not be flagged
      // for missing firstName, lastName, email
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should track all intent values even when no fields are read inside the block', () => {
      const intentTopLevelPath = path.join(
        fixturesDir,
        'app/routes/intent-toplevel.tsx'
      );
      const exports = parseRouteExports(intentTopLevelPath);

      // Should have intent groups for all three intents
      expect(exports.intentFieldGroups).toBeDefined();
      expect(exports.intentFieldGroups!.has('edit')).toBe(true);
      expect(exports.intentFieldGroups!.has('delete')).toBe(true);
      expect(exports.intentFieldGroups!.has('archive')).toBe(true);

      // delete and archive should have empty arrays (no fields read inside)
      expect(exports.intentFieldGroups!.get('delete')).toEqual([]);
      expect(exports.intentFieldGroups!.get('archive')).toEqual([]);
    });
  });

  describe('named export helper components', () => {
    it('should not flag forms inside named export functions', () => {
      const routes = parseRoutes(fixturesDir);
      const connectedDialogPath = path.join(
        fixturesDir,
        'app/routes/connected-dialog.tsx'
      );
      const component = parseComponent(connectedDialogPath);

      expect(component.forms.length).toBeGreaterThanOrEqual(2);
      expect(component.hasAction).toBe(false);

      const issues = checkForms([component], routes, fixturesDir);

      const noActionErrors = issues.filter((i) =>
        i.message.includes('no action export')
      );
      expect(noActionErrors).toHaveLength(0);
    });

    it('should mark forms inside named exports with inNamedExport flag', () => {
      const connectedDialogPath = path.join(
        fixturesDir,
        'app/routes/connected-dialog.tsx'
      );
      const component = parseComponent(connectedDialogPath);

      expect(component.forms.every((f) => f.inNamedExport)).toBe(true);
    });
  });
});
