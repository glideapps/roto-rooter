import * as path from 'path';
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from '../types.js';
import { matchRoute } from '../parsers/route-parser.js';
import {
  parseRouteExports,
  type RouteExports,
} from '../parsers/action-parser.js';

/**
 * Check form-action wiring
 */
export function checkForms(
  components: ComponentAnalysis[],
  routes: RouteDefinition[],
  rootDir: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  for (const component of components) {
    for (const form of component.forms) {
      const formIssues = validateForm(form, component, routes, rootDir);
      issues.push(...formIssues);
    }
  }

  return issues;
}

/**
 * Validate a single form
 */
function validateForm(
  form: ComponentAnalysis['forms'][0],
  component: ComponentAnalysis,
  routes: RouteDefinition[],
  rootDir: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  // If form has an explicit action, check that route has an action handler
  if (form.action) {
    const targetRoute = matchRoute(form.action, routes);

    if (!targetRoute) {
      issues.push({
        category: 'forms',
        severity: 'error',
        message: `Form action targets non-existent route: ${form.action}`,
        location: form.location,
        code: `<Form action="${form.action}">`,
      });
    } else {
      // Check if the target route file has an action export
      const routeFilePath = path.join(rootDir, 'app', targetRoute.file);
      try {
        const exports = parseRouteExports(routeFilePath);
        if (!exports.hasAction) {
          issues.push({
            category: 'forms',
            severity: 'error',
            message: `Form action targets route without action export`,
            location: form.location,
            code: `<Form action="${form.action}">`,
            suggestion: `Add an action export to ${targetRoute.file}`,
          });
        } else {
          // Action exists - check field alignment
          const fieldIssues = validateFormFields(
            form,
            exports,
            targetRoute.file
          );
          issues.push(...fieldIssues);
        }
      } catch {
        // File doesn't exist or can't be parsed - route-parser should catch this
      }
    }
  } else {
    // Form submits to current route - check if current file has action
    if (!component.hasAction) {
      issues.push({
        category: 'forms',
        severity: 'error',
        message: 'Form in route with no action export',
        location: form.location,
        code: '<Form>',
        suggestion: 'Add an action export to handle form submission',
      });
    } else {
      // Action exists in current file - check field alignment
      const routeFilePath = component.file;
      try {
        const exports = parseRouteExports(routeFilePath);
        if (exports.actionFields) {
          const fieldIssues = validateFormFields(form, exports);
          issues.push(...fieldIssues);
        }
      } catch {
        // Parsing failed - skip field validation
      }
    }
  }

  return issues;
}

/**
 * Validate that form fields align with what the action expects
 */
function validateFormFields(
  form: ComponentAnalysis['forms'][0],
  exports: RouteExports,
  targetFile?: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  const formFields = new Set(form.inputNames);
  const actionFields = new Set(exports.actionFields ?? []);

  // Skip validation if action doesn't read any fields (might use Object.fromEntries or similar)
  if (actionFields.size === 0) {
    return issues;
  }

  // Check for fields the action expects but form doesn't provide
  for (const actionField of actionFields) {
    if (!formFields.has(actionField)) {
      const formCode = form.action
        ? `<Form action="${form.action}">`
        : '<Form>';
      issues.push({
        category: 'forms',
        severity: 'error',
        message: `Action reads field '${actionField}' but form has no input with name="${actionField}"`,
        location: form.location,
        code: formCode,
        suggestion: targetFile
          ? `Add <input name="${actionField}" /> to the form, or check the action in ${targetFile}`
          : `Add <input name="${actionField}" /> to the form`,
      });
    }
  }

  // Check for form fields the action never reads (warning - might be intentional)
  for (const formField of formFields) {
    if (!actionFields.has(formField)) {
      const formCode = form.action
        ? `<Form action="${form.action}">`
        : '<Form>';
      issues.push({
        category: 'forms',
        severity: 'warning',
        message: `Form field '${formField}' is never read by the action`,
        location: form.location,
        code: formCode,
        suggestion: `Remove unused input or add formData.get('${formField}') to the action`,
      });
    }
  }

  return issues;
}
