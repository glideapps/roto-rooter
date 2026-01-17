/**
 * Represents a route definition parsed from app/routes.ts
 */
export interface RouteDefinition {
  /** The URL path pattern (e.g., "/employees/:id") */
  path: string;
  /** The file path relative to app/ (e.g., "routes/employees.$id.tsx") */
  file: string;
  /** Route ID if specified */
  id?: string;
  /** Extracted param names from the path (e.g., ["id"]) */
  params: string[];
  /** Regex for matching URLs against this route */
  pattern: RegExp;
  /** Child routes for layouts */
  children?: RouteDefinition[];
}

/**
 * Represents a Link found in a component
 */
export interface LinkReference {
  /** The href/to value */
  href: string;
  /** Whether this is a template literal with interpolation */
  isDynamic: boolean;
  /** The extracted pattern for dynamic links (e.g., "/employees/:param") */
  pattern?: string;
  /** Source location */
  location: SourceLocation;
  /** The type of link */
  type: 'link' | 'redirect' | 'navigate';
}

/**
 * Represents a Form found in a component
 */
export interface FormReference {
  /** The action attribute value */
  action?: string;
  /** The HTTP method */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Input names within the form */
  inputNames: string[];
  /** Source location */
  location: SourceLocation;
}

/**
 * Represents a useLoaderData or useActionData call
 */
export interface DataHookReference {
  /** The hook name */
  hook: 'useLoaderData' | 'useActionData' | 'useParams';
  /** Param names accessed (for useParams) */
  accessedParams?: string[];
  /** Source location */
  location: SourceLocation;
}

/**
 * Represents a potential SSR hydration mismatch pattern
 */
export interface HydrationRisk {
  /** The type of risky pattern */
  type:
    | 'date-render' // new Date(), Date.now() in render
    | 'locale-format' // Intl.DateTimeFormat, toLocaleString without timezone
    | 'random-value' // Math.random(), uuid() in render
    | 'browser-api' // window, localStorage, document outside useEffect
    | 'loader-date'; // Date field from loader rendered without handling
  /** Source location */
  location: SourceLocation;
  /** The code snippet */
  code: string;
  /** Whether this is inside useEffect (safe) */
  inUseEffect: boolean;
  /** Whether suppressHydrationWarning is present on parent element */
  hasSuppressWarning: boolean;
}

/**
 * Analysis result for a single component file
 */
export interface ComponentAnalysis {
  /** The file path */
  file: string;
  /** All Link references found */
  links: LinkReference[];
  /** All Form references found */
  forms: FormReference[];
  /** All data hook references found */
  dataHooks: DataHookReference[];
  /** All hydration risk patterns found */
  hydrationRisks: HydrationRisk[];
  /** Whether this file exports a loader function */
  hasLoader: boolean;
  /** Whether this file exports an action function */
  hasAction: boolean;
}

/**
 * Source location in a file
 */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

/**
 * An issue found by the analyzer
 */
export interface AnalyzerIssue {
  /** The check category */
  category:
    | 'links'
    | 'forms'
    | 'loader'
    | 'params'
    | 'interactive'
    | 'a11y'
    | 'hydration';
  /** Severity level */
  severity: 'error' | 'warning';
  /** Human-readable message */
  message: string;
  /** Source location */
  location: SourceLocation;
  /** The problematic code snippet */
  code?: string;
  /** Suggestion for fix (e.g., "Did you mean: /employees/:id?") */
  suggestion?: string;
}

/**
 * Result of running the analyzer
 */
export interface AnalyzerResult {
  /** All issues found */
  issues: AnalyzerIssue[];
  /** Routes that were parsed */
  routes: RouteDefinition[];
  /** Components that were analyzed */
  components: ComponentAnalysis[];
}

/**
 * CLI options
 */
export interface CliOptions {
  /** Files to check (empty = all) */
  files: string[];
  /** Checks to run (empty = all) */
  checks: string[];
  /** Output format */
  format: 'text' | 'json';
  /** Root directory of the project */
  root: string;
}
