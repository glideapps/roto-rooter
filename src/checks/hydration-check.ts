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
      return {
        category: 'hydration',
        severity: 'error',
        message: 'Date created during render causes hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Move to useEffect, use suppressHydrationWarning, or pass date from loader',
      };

    case 'locale-format':
      return {
        category: 'hydration',
        severity: 'error',
        message:
          'Locale-dependent formatting without explicit timeZone causes hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Add { timeZone: "UTC" } option, use suppressHydrationWarning, or format in useEffect',
      };

    case 'random-value':
      return {
        category: 'hydration',
        severity: 'error',
        message: 'Random value in render will cause hydration mismatch',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Use React.useId() for IDs, or generate in useEffect and store in state',
      };

    case 'browser-api':
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
