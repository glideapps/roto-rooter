import type { AnalyzerIssue, ComponentAnalysis } from '../types.js';

/**
 * Check loader-component binding
 */
export function checkLoaders(components: ComponentAnalysis[]): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  for (const component of components) {
    const componentIssues = validateLoaderUsage(component);
    issues.push(...componentIssues);
  }

  return issues;
}

/**
 * Validate loader usage in a component
 */
function validateLoaderUsage(component: ComponentAnalysis): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  // Check for clientLoader/clientAction with server-only imports
  if (component.hasClientLoader && component.serverImports.length > 0) {
    const modules = component.serverImports.join(', ');
    const issue: AnalyzerIssue = {
      category: 'loader',
      severity: 'error',
      message: `clientLoader imports server-only module '${component.serverImports[0]}' -- clientLoader runs in the browser and cannot access server resources`,
      location: component.clientLoaderSpan
        ? {
            file: component.clientLoaderSpan.file,
            line: component.clientLoaderSpan.line,
            column: component.clientLoaderSpan.column,
          }
        : { file: component.file, line: 1, column: 1 },
      code: `clientLoader (imports: ${modules})`,
      suggestion: 'Rename clientLoader to loader',
    };

    if (component.clientLoaderSpan) {
      issue.fix = {
        description: 'Rename clientLoader to loader',
        edits: [
          {
            file: component.clientLoaderSpan.file,
            start: component.clientLoaderSpan.start,
            end: component.clientLoaderSpan.end,
            newText: 'loader',
          },
        ],
      };
    }

    issues.push(issue);
  }

  if (component.hasClientAction && component.serverImports.length > 0) {
    const modules = component.serverImports.join(', ');
    const issue: AnalyzerIssue = {
      category: 'loader',
      severity: 'error',
      message: `clientAction imports server-only module '${component.serverImports[0]}' -- clientAction runs in the browser and cannot access server resources`,
      location: component.clientActionSpan
        ? {
            file: component.clientActionSpan.file,
            line: component.clientActionSpan.line,
            column: component.clientActionSpan.column,
          }
        : { file: component.file, line: 1, column: 1 },
      code: `clientAction (imports: ${modules})`,
      suggestion: 'Rename clientAction to action',
    };

    if (component.clientActionSpan) {
      issue.fix = {
        description: 'Rename clientAction to action',
        edits: [
          {
            file: component.clientActionSpan.file,
            start: component.clientActionSpan.start,
            end: component.clientActionSpan.end,
            newText: 'action',
          },
        ],
      };
    }

    issues.push(issue);
  }

  // Check for useLoaderData/useActionData without corresponding export
  // clientLoader/clientAction also provide data to these hooks
  for (const hook of component.dataHooks) {
    if (
      hook.hook === 'useLoaderData' &&
      !component.hasLoader &&
      !component.hasClientLoader
    ) {
      issues.push({
        category: 'loader',
        severity: 'error',
        message: 'useLoaderData() called but route has no loader',
        location: hook.location,
        code: 'useLoaderData()',
        suggestion: 'Add a loader function or remove the hook',
      });
    }

    if (
      hook.hook === 'useActionData' &&
      !component.hasAction &&
      !component.hasClientAction
    ) {
      issues.push({
        category: 'loader',
        severity: 'warning',
        message: 'useActionData() called but route has no action',
        location: hook.location,
        code: 'useActionData()',
        suggestion: 'Add an action function or remove the hook',
      });
    }
  }

  return issues;
}
