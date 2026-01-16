import * as path from "path";
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from "../types.js";
import { matchRoute } from "../parsers/route-parser.js";
import { parseRouteExports } from "../parsers/action-parser.js";

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
  form: ComponentAnalysis["forms"][0],
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
        category: "forms",
        severity: "error",
        message: `Form action targets non-existent route: ${form.action}`,
        location: form.location,
        code: `<Form action="${form.action}">`,
      });
    } else {
      // Check if the target route file has an action export
      const routeFilePath = path.join(rootDir, "app", targetRoute.file);
      try {
        const exports = parseRouteExports(routeFilePath);
        if (!exports.hasAction) {
          issues.push({
            category: "forms",
            severity: "error",
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
      issues.push({
        category: "forms",
        severity: "error",
        message: "Form in route with no action export",
        location: form.location,
        code: "<Form>",
        suggestion: "Add an action export to handle form submission",
      });
    }
  }

  // Check for inputs without name attribute
  // Note: We track inputNames, but we should also warn about inputs WITHOUT names
  // This would require more sophisticated tracking in the component parser
  // For now, we'll skip this check

  return issues;
}
