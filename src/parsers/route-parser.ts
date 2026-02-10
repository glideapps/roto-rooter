import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import type { RouteDefinition } from '../types.js';
import { parseFile, walkAst } from '../utils/ast-utils.js';

/**
 * Parse the app/routes.ts file and extract route definitions.
 * Resolves imports from other route files (e.g., [...trustedRoutes, ...appRoutes]).
 */
export function parseRoutes(rootDir: string): RouteDefinition[] {
  const routesPath = path.join(rootDir, 'app', 'routes.ts');

  if (!fs.existsSync(routesPath)) {
    throw new Error(`Routes file not found: ${routesPath}`);
  }

  const content = fs.readFileSync(routesPath, 'utf-8');
  const sourceFile = parseFile(routesPath, content);

  // Collect default imports: identifier name -> resolved file path
  const imports = collectDefaultImports(sourceFile, path.dirname(routesPath));

  const routes: RouteDefinition[] = [];

  walkAst(sourceFile, (node) => {
    // Look for the default export array
    if (ts.isExportAssignment(node) && node.expression) {
      const extracted = extractRoutesFromExpression(
        node.expression,
        rootDir,
        imports
      );
      routes.push(...extracted);
    }
  });

  return routes;
}

/**
 * Collect default import declarations from a source file.
 * Maps imported identifier names to resolved file paths.
 * e.g., `import appRoutes from "./app-routes"` -> { "appRoutes": "/abs/path/app-routes.ts" }
 */
function collectDefaultImports(
  sourceFile: ts.SourceFile,
  sourceDir: string
): Map<string, string> {
  const imports = new Map<string, string>();

  walkAst(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.name &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const identifierName = node.importClause.name.text;
      const modulePath = node.moduleSpecifier.text;

      // Only resolve relative imports (local route files)
      if (modulePath.startsWith('.')) {
        const resolved = resolveModulePath(sourceDir, modulePath);
        if (resolved) {
          imports.set(identifierName, resolved);
        }
      }
    }
  });

  return imports;
}

/**
 * Resolve a relative module path to an absolute file path.
 * Tries .ts extension if the path has no extension.
 */
function resolveModulePath(
  sourceDir: string,
  modulePath: string
): string | undefined {
  const basePath = path.resolve(sourceDir, modulePath);

  // Try exact path first, then .ts extension
  for (const candidate of [basePath, `${basePath}.ts`]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Extract routes from an imported file's default export.
 * Parses the file and finds `export default [...]` or `const x = [...]; export default x`.
 */
function extractRoutesFromImportedFile(
  filePath: string,
  rootDir: string
): RouteDefinition[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseFile(filePath, content);
  const routes: RouteDefinition[] = [];

  // Collect local variable declarations (for `const x = [...]; export default x`)
  const localVars = new Map<string, ts.Expression>();
  walkAst(sourceFile, (node) => {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length > 0
    ) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          localVars.set(decl.name.text, decl.initializer);
        }
      }
    }
  });

  walkAst(sourceFile, (node) => {
    if (ts.isExportAssignment(node) && node.expression) {
      let expr = node.expression;

      // If the export is an identifier, resolve it to a local variable
      if (ts.isIdentifier(expr)) {
        const resolved = localVars.get(expr.text);
        if (resolved) {
          expr = resolved;
        }
      }

      const extracted = extractRoutesFromExpression(expr, rootDir, new Map());
      routes.push(...extracted);
    }
  });

  return routes;
}

/**
 * Extract routes from an expression (array literal or call expression).
 * Handles spread elements by resolving imported identifiers to their source files.
 */
function extractRoutesFromExpression(
  expr: ts.Expression,
  rootDir: string,
  imports: Map<string, string>
): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  // Array literal: [route(...), ...importedRoutes]
  if (ts.isArrayLiteralExpression(expr)) {
    for (const element of expr.elements) {
      // Handle spread elements: [...importedRoutes]
      if (ts.isSpreadElement(element)) {
        const spreadArg = element.expression;
        if (ts.isIdentifier(spreadArg)) {
          const importedFile = imports.get(spreadArg.text);
          if (importedFile) {
            const imported = extractRoutesFromImportedFile(
              importedFile,
              rootDir
            );
            routes.push(...imported);
            continue;
          }
        }
        // If spread arg isn't a resolvable import, try extracting directly
        const extracted = extractRoutesFromExpression(
          spreadArg,
          rootDir,
          imports
        );
        routes.push(...extracted);
        continue;
      }

      const extracted = extractRoutesFromExpression(element, rootDir, imports);
      routes.push(...extracted);
    }
    return routes;
  }

  // "as" expression: [...] satisfies RouteConfig
  if (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr)) {
    return extractRoutesFromExpression(expr.expression, rootDir, imports);
  }

  // Call expression: route("/path", "file.tsx") or layout("file.tsx", [...])
  if (ts.isCallExpression(expr)) {
    const funcName = ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : undefined;

    if (funcName === 'route') {
      const route = parseRouteCall(expr, rootDir, imports);
      if (route) {
        routes.push(route);
      }
    } else if (funcName === 'layout') {
      const layoutRoutes = parseLayoutCall(expr, rootDir, imports);
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
  rootDir: string,
  imports: Map<string, string>
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
      children = extractRoutesFromExpression(thirdArg, rootDir, imports);
    }
  }

  // Fourth arg could be children if third was options
  if (args.length >= 4) {
    const fourthArg = args[3];
    if (ts.isArrayLiteralExpression(fourthArg)) {
      children = extractRoutesFromExpression(fourthArg, rootDir, imports);
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
  rootDir: string,
  imports: Map<string, string>
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
  const children = extractRoutesFromExpression(childrenArg, rootDir, imports);

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
