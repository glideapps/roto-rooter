import * as path from 'path';
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from '../types.js';
import { matchRoute, getAllRoutePaths } from '../parsers/route-parser.js';
import { parseRouteExports } from '../parsers/action-parser.js';
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
    }
  }

  return issues;
}
