import * as path from 'path';
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from '../types.js';
import { findBestMatch } from '../utils/suggestion.js';

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
      const fullPath = path.join(rootDir, 'app', route.file);
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
    if (hook.hook === 'useParams' && hook.accessedParams) {
      for (const param of hook.accessedParams) {
        if (!routeParams.has(param)) {
          const issue: AnalyzerIssue = {
            category: 'params',
            severity: 'error',
            message: `useParams() accesses "${param}" but route has no :${param} parameter`,
            location: hook.location,
            code: `useParams().${param}`,
            suggestion:
              route.params.length > 0
                ? `Available params: ${route.params.map((p) => ':' + p).join(', ')}`
                : `Route ${route.path} has no parameters`,
          };

          // Try to create a fix if we can determine the correct param
          const paramSpan = hook.paramSpans?.get(param);
          if (paramSpan && route.params.length > 0) {
            // If there's only one route param, rename to it
            // Otherwise, use fuzzy matching
            let correctParam: string | undefined;
            if (route.params.length === 1) {
              correctParam = route.params[0];
            } else {
              correctParam = findBestMatch(param, route.params);
            }

            if (correctParam) {
              issue.fix = {
                description: `Renamed "${param}" to "${correctParam}"`,
                edits: [
                  {
                    file: paramSpan.file,
                    start: paramSpan.start,
                    end: paramSpan.end,
                    newText: correctParam,
                  },
                ],
              };
            }
          }

          issues.push(issue);
        }
      }
    }
  }

  return issues;
}
