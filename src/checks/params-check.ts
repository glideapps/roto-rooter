import * as path from "path";
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from "../types.js";

/**
 * Check route parameter consistency
 */
export function checkParams(
  components: ComponentAnalysis[],
  routes: RouteDefinition[],
  rootDir: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  // Build a map of file -> route definition
  const fileToRoute = new Map<string, RouteDefinition>();
  function mapRoutes(routeList: RouteDefinition[]) {
    for (const route of routeList) {
      const fullPath = path.join(rootDir, "app", route.file);
      fileToRoute.set(fullPath, route);
      if (route.children) {
        mapRoutes(route.children);
      }
    }
  }
  mapRoutes(routes);

  for (const component of components) {
    const route = fileToRoute.get(component.file);
    if (!route) {
      // Not a route file
      continue;
    }

    const componentIssues = validateParamUsage(component, route);
    issues.push(...componentIssues);
  }

  return issues;
}

/**
 * Validate param usage in a component against its route definition
 */
function validateParamUsage(
  component: ComponentAnalysis,
  route: RouteDefinition
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];
  const routeParams = new Set(route.params);

  for (const hook of component.dataHooks) {
    if (hook.hook === "useParams" && hook.accessedParams) {
      for (const param of hook.accessedParams) {
        if (!routeParams.has(param)) {
          issues.push({
            category: "params",
            severity: "error",
            message: `useParams() accesses "${param}" but route has no :${param} parameter`,
            location: hook.location,
            code: `useParams().${param}`,
            suggestion:
              route.params.length > 0
                ? `Available params: ${route.params.map((p) => ":" + p).join(", ")}`
                : `Route ${route.path} has no parameters`,
          });
        }
      }
    }
  }

  return issues;
}
