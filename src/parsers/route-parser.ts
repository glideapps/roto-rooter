import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import type { RouteDefinition } from '../types.js';
import { parseFile, walkAst } from '../utils/ast-utils.js';

/**
 * Parse the app/routes.ts file and extract route definitions
 */
export function parseRoutes(rootDir: string): RouteDefinition[] {
  const routesPath = path.join(rootDir, 'app', 'routes.ts');

  if (!fs.existsSync(routesPath)) {
    throw new Error(`Routes file not found: ${routesPath}`);
  }

  const content = fs.readFileSync(routesPath, 'utf-8');
  const sourceFile = parseFile(routesPath, content);

  const routes: RouteDefinition[] = [];

  walkAst(sourceFile, (node) => {
    // Look for the default export array
    if (ts.isExportAssignment(node) && node.expression) {
      const extracted = extractRoutesFromExpression(node.expression, rootDir);
      routes.push(...extracted);
    }
  });

  return routes;
}

/**
 * Extract routes from an expression (array literal or call expression)
 */
function extractRoutesFromExpression(
  expr: ts.Expression,
  rootDir: string
): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  // Array literal: [route(...), route(...)]
  if (ts.isArrayLiteralExpression(expr)) {
    for (const element of expr.elements) {
      const extracted = extractRoutesFromExpression(element, rootDir);
      routes.push(...extracted);
    }
    return routes;
  }

  // "as" expression: [...] satisfies RouteConfig
  if (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr)) {
    return extractRoutesFromExpression(expr.expression, rootDir);
  }

  // Call expression: route("/path", "file.tsx") or layout("file.tsx", [...])
  if (ts.isCallExpression(expr)) {
    const funcName = ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : undefined;

    if (funcName === 'route') {
      const route = parseRouteCall(expr, rootDir);
      if (route) {
        routes.push(route);
      }
    } else if (funcName === 'layout') {
      const layoutRoutes = parseLayoutCall(expr, rootDir);
      routes.push(...layoutRoutes);
    } else if (funcName === 'index') {
      const route = parseIndexCall(expr, rootDir);
      if (route) {
        routes.push(route);
      }
    }
  }

  return routes;
}

/**
 * Parse a route() call expression
 * route("/employees", "routes/employees.tsx")
 * route("/employees/:id", "routes/employees.$id.tsx", { id: "employee-detail" })
 */
function parseRouteCall(
  call: ts.CallExpression,
  rootDir: string
): RouteDefinition | undefined {
  const args = call.arguments;
  if (args.length < 2) {
    return undefined;
  }

  // First arg: path
  const pathArg = args[0];
  if (!ts.isStringLiteral(pathArg)) {
    return undefined;
  }
  const routePath = pathArg.text;

  // Second arg: file path
  const fileArg = args[1];
  if (!ts.isStringLiteral(fileArg)) {
    return undefined;
  }
  const file = fileArg.text;

  // Third arg (optional): options { id: "..." }
  let id: string | undefined;
  let children: RouteDefinition[] | undefined;

  if (args.length >= 3) {
    const thirdArg = args[2];

    // Check if it's an options object
    if (ts.isObjectLiteralExpression(thirdArg)) {
      for (const prop of thirdArg.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'id' &&
          ts.isStringLiteral(prop.initializer)
        ) {
          id = prop.initializer.text;
        }
      }
    }

    // Check if it's a children array
    if (ts.isArrayLiteralExpression(thirdArg)) {
      children = extractRoutesFromExpression(thirdArg, rootDir);
    }
  }

  // Fourth arg could be children if third was options
  if (args.length >= 4) {
    const fourthArg = args[3];
    if (ts.isArrayLiteralExpression(fourthArg)) {
      children = extractRoutesFromExpression(fourthArg, rootDir);
    }
  }

  return createRouteDefinition(routePath, file, id, children);
}

/**
 * Parse a layout() call expression
 * layout("routes/_layout.tsx", [...])
 */
function parseLayoutCall(
  call: ts.CallExpression,
  rootDir: string
): RouteDefinition[] {
  const args = call.arguments;
  if (args.length < 2) {
    return [];
  }

  // First arg: layout file path
  const fileArg = args[0];
  if (!ts.isStringLiteral(fileArg)) {
    return [];
  }

  // Second arg: children array
  const childrenArg = args[1];
  const children = extractRoutesFromExpression(childrenArg, rootDir);

  // Layout itself doesn't define a path, so we just return the children
  // but we could track the layout file for other checks
  return children;
}

/**
 * Parse an index() call expression
 * index("routes/home.tsx")
 */
function parseIndexCall(
  call: ts.CallExpression,
  _rootDir: string
): RouteDefinition | undefined {
  const args = call.arguments;
  if (args.length < 1) {
    return undefined;
  }

  const fileArg = args[0];
  if (!ts.isStringLiteral(fileArg)) {
    return undefined;
  }

  return createRouteDefinition('/', fileArg.text, undefined, undefined);
}

/**
 * Create a RouteDefinition with computed params and pattern
 */
function createRouteDefinition(
  routePath: string,
  file: string,
  id?: string,
  children?: RouteDefinition[]
): RouteDefinition {
  const params = extractParams(routePath);
  const pattern = pathToRegex(routePath);

  return {
    path: routePath,
    file,
    id,
    params,
    pattern,
    children: children && children.length > 0 ? children : undefined,
  };
}

/**
 * Extract param names from a route path
 * "/employees/:id/tasks/:taskId" -> ["id", "taskId"]
 */
function extractParams(routePath: string): string[] {
  const params: string[] = [];
  const regex = /:(\w+)/g;
  let match;
  while ((match = regex.exec(routePath)) !== null) {
    params.push(match[1]);
  }
  return params;
}

/**
 * Convert a route path to a regex for matching
 * "/employees/:id" -> /^\/employees\/[^/]+$/
 */
function pathToRegex(routePath: string): RegExp {
  // Escape special regex chars except :
  let pattern = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Replace :param with a capturing group that matches any non-slash characters
  pattern = pattern.replace(/:(\w+)/g, '([^/]+)');

  return new RegExp(`^${pattern}$`);
}

/**
 * Get all route paths as strings for matching
 */
export function getAllRoutePaths(routes: RouteDefinition[]): string[] {
  const paths: string[] = [];

  function collect(routeList: RouteDefinition[]) {
    for (const route of routeList) {
      paths.push(route.path);
      if (route.children) {
        collect(route.children);
      }
    }
  }

  collect(routes);
  return paths;
}

/**
 * Check if a URL matches any route
 * Query strings and hash fragments are stripped before matching
 */
export function matchRoute(
  url: string,
  routes: RouteDefinition[]
): RouteDefinition | undefined {
  // Strip query string and hash fragment before matching
  const pathOnly = url.split('?')[0].split('#')[0];

  for (const route of routes) {
    if (route.pattern.test(pathOnly)) {
      return route;
    }
    if (route.children) {
      const childMatch = matchRoute(pathOnly, route.children);
      if (childMatch) {
        return childMatch;
      }
    }
  }
  return undefined;
}

/**
 * Check if a dynamic link pattern could match a route
 * Pattern like "/employees/:param" should match route "/employees/:id"
 */
export function matchDynamicPattern(
  pattern: string,
  routes: RouteDefinition[]
): RouteDefinition | undefined {
  // Normalize the pattern to compare segment counts and static parts
  const patternParts = pattern.split('/').filter(Boolean);

  for (const route of routes) {
    const routeParts = route.path.split('/').filter(Boolean);

    if (patternParts.length !== routeParts.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const routePart = routeParts[i];

      // Both dynamic - OK
      if (patternPart.startsWith(':') && routePart.startsWith(':')) {
        continue;
      }

      // Both static - must match exactly
      if (!patternPart.startsWith(':') && !routePart.startsWith(':')) {
        if (patternPart !== routePart) {
          matches = false;
          break;
        }
        continue;
      }

      // One dynamic, one static - OK (dynamic in pattern matches any route segment)
      if (patternPart.startsWith(':')) {
        continue;
      }

      // Static in pattern, dynamic in route - doesn't match
      matches = false;
      break;
    }

    if (matches) {
      return route;
    }

    // Check children
    if (route.children) {
      const childMatch = matchDynamicPattern(pattern, route.children);
      if (childMatch) {
        return childMatch;
      }
    }
  }

  return undefined;
}
