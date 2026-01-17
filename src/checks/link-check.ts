import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from '../types.js';
import {
  matchRoute,
  matchDynamicPattern,
  getAllRoutePaths,
} from '../parsers/route-parser.js';
import { findBestMatch, formatSuggestion } from '../utils/suggestion.js';

/**
 * Check all links in components against defined routes
 */
export function checkLinks(
  components: ComponentAnalysis[],
  routes: RouteDefinition[]
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];
  const allPaths = getAllRoutePaths(routes);

  for (const component of components) {
    for (const link of component.links) {
      const issue = validateLink(link, routes, allPaths);
      if (issue) {
        issues.push(issue);
      }
    }
  }

  return issues;
}

/**
 * Validate a single link
 */
function validateLink(
  link: ComponentAnalysis['links'][0],
  routes: RouteDefinition[],
  allPaths: string[]
): AnalyzerIssue | undefined {
  if (link.isDynamic) {
    // For dynamic links, check the pattern
    const pattern = link.pattern || link.href;
    const match = matchDynamicPattern(pattern, routes);

    if (!match) {
      const suggestion = findBestMatch(pattern, allPaths);
      return {
        category: 'links',
        severity: 'error',
        message: 'No matching route for dynamic link pattern',
        location: link.location,
        code: `${link.type === 'link' ? 'href' : link.type}="${link.href}"`,
        suggestion: formatSuggestion(suggestion),
      };
    }
  } else {
    // For static links, do exact matching
    const match = matchRoute(link.href, routes);

    if (!match) {
      const suggestion = findBestMatch(link.href, allPaths);
      return {
        category: 'links',
        severity: 'error',
        message: 'No matching route',
        location: link.location,
        code: `${link.type === 'link' ? 'href' : link.type}="${link.href}"`,
        suggestion: formatSuggestion(suggestion),
      };
    }
  }

  return undefined;
}
