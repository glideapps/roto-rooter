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
  /** Span of the attribute value for auto-fix */
  attributeSpan?: SourceSpan;
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
  /** The intent value from a button/input with name="intent" */
  intentValue?: string;
  /** Source location */
  location: SourceLocation;
  /** Span of the action attribute value for auto-fix */
  actionSpan?: SourceSpan;
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
  /** Spans of param identifiers for auto-fix (maps param name to its span) */
  paramSpans?: Map<string, SourceSpan>;
}

/**
 * Priority for hydration risk deduplication.
 * Higher priority errors suppress overlapping lower priority errors.
 * More specific/actionable errors have higher priority.
 */
export type HydrationRiskPriority = 0 | 1 | 2 | 3;

/**
 * Get priority for a hydration risk type.
 * Higher priority = more specific/actionable error.
 */
export function getHydrationRiskPriority(
  type: HydrationRisk['type']
): HydrationRiskPriority {
  switch (type) {
    case 'locale-format':
      return 3; // Most specific, has auto-fix
    case 'random-value':
      return 2; // Specific, often has auto-fix
    case 'browser-api':
      return 1; // Specific to browser APIs
    case 'date-render':
    case 'loader-date':
      return 0; // Generic, no auto-fix
  }
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
  /** Span of the call expression for auto-fix */
  callSpan?: SourceSpan;
  /** For locale-format: number of arguments in the call (for determining fix) */
  argCount?: number;
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
 * Source span with start and end positions for precise text replacement
 */
export interface SourceSpan {
  file: string;
  /** Start position (0-based byte offset in file) */
  start: number;
  /** End position (0-based byte offset in file) */
  end: number;
  /** Line number for display (1-based) */
  line: number;
  /** Column number for display (1-based) */
  column: number;
}

/**
 * A single text edit operation
 */
export interface TextEdit {
  /** File to modify */
  file: string;
  /** Start position (0-based byte offset) */
  start: number;
  /** End position (0-based byte offset) */
  end: number;
  /** Replacement text (empty string = deletion) */
  newText: string;
}

/**
 * A fix that can be applied to source code
 */
export interface IssueFix {
  /** Human-readable description of what the fix does */
  description: string;
  /** The text replacements to apply */
  edits: TextEdit[];
}

/**
 * An issue found by the analyzer
 */
export interface AnalyzerIssue {
  /** The check category */
  category: 'links' | 'forms' | 'loader' | 'params' | 'hydration';
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
  /** Auto-fix for this issue, if available */
  fix?: IssueFix;
}

/**
 * Result of applying fixes
 */
export interface FixResult {
  /** Files that were modified */
  filesModified: string[];
  /** Number of fixes applied */
  fixesApplied: number;
  /** Issues that were fixed */
  fixedIssues: AnalyzerIssue[];
  /** Issues that could not be fixed */
  unfixableIssues: AnalyzerIssue[];
  /** Errors encountered while applying fixes */
  errors: Array<{ file: string; error: string }>;
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
  /** Apply fixes automatically */
  fix?: boolean;
  /** Show what would be fixed without modifying files */
  dryRun?: boolean;
}
