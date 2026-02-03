import * as path from 'path';
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from '../types.js';
import { matchRoute, getAllRoutePaths } from '../parsers/route-parser.js';
import {
  parseRouteExports,
  type RouteExports,
} from '../parsers/action-parser.js';
import { findBestMatch, formatSuggestion } from '../utils/suggestion.js';

/**
 * Check form-action wiring
 */
export function checkForms(
  components: ComponentAnalysis[],
  routes: RouteDefinition[],
  rootDir: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];
  const allPaths = getAllRoutePaths(routes);

  for (const component of components) {
    for (const form of component.forms) {
      const formIssues = validateForm(
        form,
        component,
        routes,
        rootDir,
        allPaths
      );
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
  rootDir: string,
  allPaths: string[]
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  // If form has an explicit action, check that route has an action handler
  if (form.action) {
    const targetRoute = matchRoute(form.action, routes);

    if (!targetRoute) {
      const suggestion = findBestMatch(form.action, allPaths);
      const issue: AnalyzerIssue = {
        category: 'forms',
        severity: 'error',
        message: `Form action targets non-existent route: ${form.action}`,
        location: form.location,
        code: `<Form action="${form.action}">`,
        suggestion: formatSuggestion(suggestion),
      };

      // Add fix if we have a suggestion and span info
      if (suggestion && form.actionSpan) {
        issue.fix = {
          description: `Replaced "${form.action}" with "${suggestion}"`,
          edits: [
            {
              file: form.actionSpan.file,
              start: form.actionSpan.start,
              end: form.actionSpan.end,
              newText: `"${suggestion}"`,
            },
          ],
        };
      }

      issues.push(issue);
    } else {
      // Check if the target route file has an action export
      const routeFilePath = path.join(rootDir, 'app', targetRoute.file);
      try {
        const exports = parseRouteExports(routeFilePath);
        if (!exports.hasAction) {
          // Not auto-fixable - requires adding business logic
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
      // Not auto-fixable - requires adding business logic
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
 *
 * When the action uses intent-based dispatch and the form has a known intent value,
 * we only validate against the fields used in that specific intent branch.
 */
function validateFormFields(
  form: ComponentAnalysis['forms'][0],
  exports: RouteExports,
  targetFile?: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  const formFields = new Set(form.inputNames);

  // Determine which action fields to check against
  let actionFieldsToCheck: string[];

  // If the form has an intent value and we have intent-based field groups, use those
  if (form.intentValue && exports.intentFieldGroups?.has(form.intentValue)) {
    actionFieldsToCheck = exports.intentFieldGroups.get(form.intentValue)!;
  } else if (
    form.intentValue &&
    exports.intentFieldGroups &&
    exports.intentFieldGroups.size > 0
  ) {
    // Form has intent but we don't recognize it - skip validation
    // This could be a typo or the action uses a different pattern
    return issues;
  } else {
    // No intent-based dispatch or form has no intent - use all action fields
    actionFieldsToCheck = exports.actionFields ?? [];
  }

  const actionFields = new Set(actionFieldsToCheck);

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

  return issues;
}
