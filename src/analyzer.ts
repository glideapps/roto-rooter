import * as fs from "fs";
import * as path from "path";
import type {
  AnalyzerResult,
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
  CliOptions,
} from "./types.js";
import { parseRoutes } from "./parsers/route-parser.js";
import { parseComponent } from "./parsers/component-parser.js";
import { checkLinks } from "./checks/link-check.js";
import { checkForms } from "./checks/form-check.js";
import { checkLoaders } from "./checks/loader-check.js";
import { checkParams } from "./checks/params-check.js";
import { checkInteractive } from "./checks/interactive-check.js";
import { checkA11y } from "./checks/a11y-check.js";

/**
 * Main analyzer - orchestrates parsing and checking
 */
export function analyze(options: CliOptions): AnalyzerResult {
  const { root, files, checks } = options;

  // Parse routes (always global)
  let routes: RouteDefinition[] = [];
  try {
    routes = parseRoutes(root);
  } catch (error) {
    // If no routes file, we can't do much
    return {
      issues: [
        {
          category: "links",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to parse routes file",
          location: {
            file: path.join(root, "app", "routes.ts"),
            line: 1,
            column: 1,
          },
        },
      ],
      routes: [],
      components: [],
    };
  }

  // Find component files to analyze
  const componentFiles = findComponentFiles(root, files);

  // Parse components
  const components: ComponentAnalysis[] = [];
  for (const file of componentFiles) {
    try {
      const analysis = parseComponent(file);
      components.push(analysis);
    } catch (error) {
      // Skip files that can't be parsed
      console.error(`Warning: Could not parse ${file}:`, error);
    }
  }

  // Run checks
  const issues: AnalyzerIssue[] = [];
  const enabledChecks = new Set(
    checks.length > 0 ? checks : ["links", "forms", "loader", "params", "interactive", "a11y"]
  );

  if (enabledChecks.has("links")) {
    issues.push(...checkLinks(components, routes));
  }

  if (enabledChecks.has("forms")) {
    issues.push(...checkForms(components, routes, root));
  }

  if (enabledChecks.has("loader")) {
    issues.push(...checkLoaders(components));
  }

  if (enabledChecks.has("params")) {
    issues.push(...checkParams(components, routes, root));
  }

  if (enabledChecks.has("interactive")) {
    issues.push(...checkInteractive(components));
  }

  if (enabledChecks.has("a11y")) {
    issues.push(...checkA11y(components));
  }

  // If specific files were provided, filter issues to only those files
  if (files.length > 0) {
    const targetFiles = new Set(files.map((f) => path.resolve(f)));
    const filteredIssues = issues.filter((issue) =>
      targetFiles.has(path.resolve(issue.location.file))
    );
    return { issues: filteredIssues, routes, components };
  }

  return { issues, routes, components };
}

/**
 * Find all component files to analyze
 */
function findComponentFiles(root: string, specificFiles: string[]): string[] {
  if (specificFiles.length > 0) {
    // Analyze only specific files (paths are independent of root)
    return specificFiles.map((f) => path.resolve(f));
  }

  // Find all TSX files in app/routes
  const routesDir = path.join(root, "app", "routes");
  if (!fs.existsSync(routesDir)) {
    return [];
  }

  const files: string[] = [];
  walkDir(routesDir, (filePath) => {
    if (filePath.endsWith(".tsx")) {
      files.push(filePath);
    }
  });

  return files;
}

/**
 * Recursively walk a directory
 */
function walkDir(dir: string, callback: (filePath: string) => void): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}
