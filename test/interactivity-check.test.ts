import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { checkInteractivity } from '../src/checks/interactivity-check.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('interactivity-check', () => {
  describe('detecting disconnected dialogs', () => {
    it('should detect dialog with inputs where Save button only closes', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      const saveIssues = issues.filter((i) =>
        i.message.includes('Save Changes')
      );
      expect(saveIssues.length).toBeGreaterThan(0);
      expect(saveIssues[0].severity).toBe('error');
      expect(saveIssues[0].message).toContain('only closes dialog');
    });

    it('should detect Delete button that only closes dialog', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      const deleteIssues = issues.filter((i) =>
        i.message.includes('Delete Employee')
      );
      expect(deleteIssues.length).toBeGreaterThan(0);
      expect(deleteIssues[0].severity).toBe('error');
      expect(deleteIssues[0].message).toContain('only closes dialog');
    });

    it('should detect Update button that only closes dialog', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      const updateIssues = issues.filter((i) =>
        i.message.includes('Update Settings')
      );
      expect(updateIssues.length).toBeGreaterThan(0);
      expect(updateIssues[0].severity).toBe('error');
    });

    it('should detect stub onClick handlers with console.log', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      const stubIssues = issues.filter(
        (i) => i.message.includes('stub') && i.message.includes('Add Item')
      );
      expect(stubIssues.length).toBeGreaterThan(0);
      expect(stubIssues[0].severity).toBe('warning');
    });

    it('should detect standalone buttons with stub function references', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // The StandaloneStubButton component has handleAddEmployee that only logs
      const standaloneIssues = issues.filter(
        (i) =>
          i.message.includes('stub') &&
          i.message.includes('Add Employee') &&
          i.code?.includes('ToolbarButton')
      );
      expect(standaloneIssues.length).toBeGreaterThan(0);
      expect(standaloneIssues[0].severity).toBe('warning');
    });
  });

  describe('allowing valid patterns', () => {
    it('should not flag dialogs with Form component', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/connected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // WorkingFormDialog and WorkingDeleteDialog use Form component
      // Should not have any Save/Delete issues for those dialogs
      const formDialogIssues = issues.filter(
        (i) =>
          i.message.includes('Edit Employee') ||
          (i.message.includes('Delete Employee') &&
            i.message.includes('only closes'))
      );
      // WorkingFormDialog has Form, so should not be flagged
      // WorkingDeleteDialog has Form, so should not be flagged
      expect(formDialogIssues).toHaveLength(0);
    });

    it('should not flag dialogs using useFetcher', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/connected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // WorkingFetcherDialog uses useFetcher
      // The file has useFetcher, so dialogs in it get benefit of doubt
      // Check that we don't flag the Save Changes button in that file
      const fetcherDialogIssues = issues.filter(
        (i) =>
          i.message.includes('Save Changes') &&
          i.message.includes('only closes')
      );
      expect(fetcherDialogIssues).toHaveLength(0);
    });

    it('should not flag Cancel buttons that close dialog', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // Cancel buttons should not be flagged
      const cancelIssues = issues.filter((i) => i.message.includes('Cancel'));
      expect(cancelIssues).toHaveLength(0);
    });

    it('should not flag Close buttons that close dialog', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/connected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // Close buttons should not be flagged
      const closeIssues = issues.filter((i) => i.message.includes('Close'));
      expect(closeIssues).toHaveLength(0);
    });

    it('should not flag info-only dialogs with OK button', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/connected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // OK button in info dialog should not be flagged
      const okIssues = issues.filter((i) => i.message.includes('"OK"'));
      expect(okIssues).toHaveLength(0);
    });
  });

  describe('issue details', () => {
    it('should include helpful suggestions', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      const dialogIssues = issues.filter(
        (i) => i.message.includes('only closes') && i.severity === 'error'
      );
      expect(dialogIssues.length).toBeGreaterThan(0);

      // All error-level issues should have suggestions
      for (const issue of dialogIssues) {
        expect(issue.suggestion).toBeTruthy();
        expect(
          issue.suggestion?.includes('Form') ||
            issue.suggestion?.includes('fetcher')
        ).toBe(true);
      }
    });

    it('should include the button text in the issue message', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      // Check that button text is quoted in message
      const saveIssues = issues.filter((i) =>
        i.message.includes('"Save Changes"')
      );
      expect(saveIssues.length).toBeGreaterThan(0);
    });

    it('should have category interactivity', () => {
      const filePath = path.join(
        fixturesDir,
        'app/routes/disconnected-dialog.tsx'
      );
      const issues = checkInteractivity([filePath]);

      expect(issues.every((i) => i.category === 'interactivity')).toBe(true);
    });
  });
});
