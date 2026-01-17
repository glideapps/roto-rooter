import type {
  AnalyzerIssue,
  ComponentAnalysis,
  HydrationRisk,
} from '../types.js';

/**
 * Check for SSR hydration mismatch risks
 *
 * Detects patterns that cause hydration mismatches between server and client:
 * - Date/time operations without consistent timezone handling
 * - Locale-dependent formatting without explicit timezone
 * - Random value generation during render
 * - Browser-only API access outside useEffect
 */
export function checkHydration(
  components: ComponentAnalysis[]
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  for (const component of components) {
    for (const risk of component.hydrationRisks) {
      // Skip risks that are already mitigated
      if (risk.inUseEffect || risk.hasSuppressWarning) {
        continue;
      }

      const issue = createIssueForRisk(risk);
      if (issue) {
        issues.push(issue);
      }
    }
  }

  return issues;
}

/**
 * Create an analyzer issue for a hydration risk
 */
function createIssueForRisk(risk: HydrationRisk): AnalyzerIssue | undefined {
  switch (risk.type) {
    case 'date-render':
      // Not auto-fixable - requires wrapping in useEffect with state management
      return {
        category: 'hydration',
        severity: 'error',
        message: 'Date created during render causes hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Move to useEffect, use suppressHydrationWarning, or pass date from loader',
      };

    case 'locale-format': {
      const issue: AnalyzerIssue = {
        category: 'hydration',
        severity: 'error',
        message:
          'Locale-dependent formatting without explicit timeZone causes hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Add { timeZone: "UTC" } option, use suppressHydrationWarning, or format in useEffect',
      };

      // Add fix for locale formatting - add timeZone option
      // Only fixable when we have callSpan and know the arg count
      if (risk.callSpan && risk.argCount !== undefined) {
        const fix = createLocaleFormatFix(risk);
        if (fix) {
          issue.fix = fix;
        }
      }

      return issue;
    }

    case 'random-value': {
      const issue: AnalyzerIssue = {
        category: 'hydration',
        severity: 'error',
        message: 'Random value in render will cause hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Use React.useId() for IDs, or generate in useEffect and store in state',
      };

      // Add fix for uuid/nanoid -> useId replacement
      if (risk.callSpan && isSimpleIdGenerator(risk.code)) {
        issue.fix = {
          description: `Replaced with useId()`,
          edits: [
            {
              file: risk.callSpan.file,
              start: risk.callSpan.start,
              end: risk.callSpan.end,
              newText: 'useId()',
            },
          ],
        };
      }

      return issue;
    }

    case 'browser-api':
      // Not auto-fixable - wrapping in typeof guard is too complex without AST context
      // The fix would depend on how the value is used (assignment, JSX, etc.)
      return {
        category: 'hydration',
        severity: 'error',
        message:
          'Browser-only API accessed during render will fail on server and cause hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Move to useEffect or check typeof window !== "undefined" first',
      };

    case 'loader-date':
      return {
        category: 'hydration',
        severity: 'warning',
        message: 'Date from loader may cause hydration mismatch when formatted',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Format with explicit timeZone, use suppressHydrationWarning, or format in useEffect',
      };

    default:
      return undefined;
  }
}

/**
 * Create a fix for locale format issues
 * Adds timeZone: "UTC" to the options argument
 */
function createLocaleFormatFix(
  risk: HydrationRisk
): AnalyzerIssue['fix'] | undefined {
  if (!risk.callSpan) return undefined;

  const argCount = risk.argCount ?? 0;

  // For toLocaleString() with 0 args: add (undefined, { timeZone: "UTC" })
  // For toLocaleString(locale) with 1 arg: add (, { timeZone: "UTC" }) at the end
  // For new Intl.DateTimeFormat() with 0 args: add (undefined, { timeZone: "UTC" })
  // For new Intl.DateTimeFormat(locale) with 1 arg: add (, { timeZone: "UTC" }) at the end

  // This is complex because we need to insert at the right position
  // For simplicity, we'll only handle the 0-arg case for toLocaleString methods
  // The fix inserts the full replacement

  // Handle toLocaleString, toLocaleDateString, toLocaleTimeString
  const methodMatch = risk.code.match(
    /\.toLocale(String|DateString|TimeString)\(\)/
  );
  if (argCount === 0 && methodMatch) {
    // Replace "date.toLocaleString()" with "date.toLocaleString(undefined, { timeZone: "UTC" })"
    const methodName = `toLocale${methodMatch[1]}`;
    const newCode = risk.code.replace(
      `.${methodName}()`,
      `.${methodName}(undefined, { timeZone: "UTC" })`
    );
    return {
      description: `Added { timeZone: "UTC" } option`,
      edits: [
        {
          file: risk.callSpan.file,
          start: risk.callSpan.start,
          end: risk.callSpan.end,
          newText: newCode,
        },
      ],
    };
  }

  // For Intl.DateTimeFormat with 0 args
  if (argCount === 0 && risk.code.includes('Intl.DateTimeFormat')) {
    const newCode = risk.code.replace(
      'Intl.DateTimeFormat()',
      'Intl.DateTimeFormat(undefined, { timeZone: "UTC" })'
    );
    if (newCode !== risk.code) {
      return {
        description: `Added { timeZone: "UTC" } option`,
        edits: [
          {
            file: risk.callSpan.file,
            start: risk.callSpan.start,
            end: risk.callSpan.end,
            newText: newCode,
          },
        ],
      };
    }
  }

  return undefined;
}

/**
 * Check if the code is a simple ID generator call that can be replaced with useId
 */
function isSimpleIdGenerator(code: string): boolean {
  // Match simple calls like uuid(), nanoid(), uuidv4(), generateId()
  return /^(uuid|nanoid|uuidv4|generateId)\(\)$/.test(code.trim());
}
