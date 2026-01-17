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

  for (const hook of component.dataHooks) {
    if (hook.hook === 'useLoaderData' && !component.hasLoader) {
      issues.push({
        category: 'loader',
        severity: 'error',
        message: 'useLoaderData() called but route has no loader',
        location: hook.location,
        code: 'useLoaderData()',
        suggestion: 'Add a loader function or remove the hook',
      });
    }

    if (hook.hook === 'useActionData' && !component.hasAction) {
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
