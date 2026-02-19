import type {
  AnalyzerIssue,
  ComponentAnalysis,
  HydrationRisk,
} from '../types.js';
import { getHydrationRiskPriority } from '../types.js';

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
    // Deduplicate overlapping risks within each component
    const deduplicatedRisks = deduplicateOverlappingRisks(
      component.hydrationRisks
    );

    for (const risk of deduplicatedRisks) {
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
 * Deduplicate overlapping hydration risks.
 *
 * Rules:
 * 1. Higher-priority errors suppress contained lower-priority errors.
 *    Example: `new Date(date).toLocaleDateString()` - the `locale-format` error
 *    (priority 3) suppresses the contained `date-render` error (priority 0).
 *
 * 2. For same-priority errors, the outermost (containing) error wins.
 *    Example: `new Date(new Date().setHours(0,0,0,0))` - only the outer
 *    `date-render` error is shown since fixing it fixes the nested one too.
 */
function deduplicateOverlappingRisks(risks: HydrationRisk[]): HydrationRisk[] {
  if (risks.length <= 1) {
    return risks;
  }

  // Group risks by file (should all be same file within a component, but be safe)
  const risksByFile = new Map<string, HydrationRisk[]>();
  for (const risk of risks) {
    const file = risk.location.file;
    if (!risksByFile.has(file)) {
      risksByFile.set(file, []);
    }
    risksByFile.get(file)!.push(risk);
  }

  const result: HydrationRisk[] = [];

  for (const fileRisks of risksByFile.values()) {
    // Sort by priority (highest first), then by span size (largest/outermost first)
    const sorted = [...fileRisks].sort((a, b) => {
      const priorityDiff =
        getHydrationRiskPriority(b.type) - getHydrationRiskPriority(a.type);
      if (priorityDiff !== 0) return priorityDiff;
      // For same priority, sort by span size (largest first = outermost)
      const aSize = a.callSpan ? a.callSpan.end - a.callSpan.start : 0;
      const bSize = b.callSpan ? b.callSpan.end - b.callSpan.start : 0;
      return bSize - aSize;
    });

    // Track which risks are suppressed by higher/outer overlapping risks
    const suppressed = new Set<HydrationRisk>();

    for (let i = 0; i < sorted.length; i++) {
      const outer = sorted[i];
      if (suppressed.has(outer)) continue;

      // Check if this risk suppresses any other risks
      if (outer.callSpan) {
        for (let j = i + 1; j < sorted.length; j++) {
          const inner = sorted[j];
          if (suppressed.has(inner)) continue;

          // Check if outer's span contains inner
          if (spanContainsLocation(outer, inner)) {
            // Higher priority always suppresses lower priority
            // Same priority: outer suppresses inner (same type nested errors)
            const outerPriority = getHydrationRiskPriority(outer.type);
            const innerPriority = getHydrationRiskPriority(inner.type);
            if (outerPriority >= innerPriority) {
              suppressed.add(inner);
            }
          }
        }
      }
    }

    // Keep only non-suppressed risks
    for (const risk of fileRisks) {
      if (!suppressed.has(risk)) {
        result.push(risk);
      }
    }
  }

  return result;
}

/**
 * Check if a higher-priority risk's span contains a lower-priority risk's location.
 * Uses byte offsets from callSpan for precise containment checking.
 */
function spanContainsLocation(
  higher: HydrationRisk,
  lower: HydrationRisk
): boolean {
  // Must have callSpan on the higher-priority risk
  if (!higher.callSpan) return false;

  // Use callSpan if available on lower, otherwise use location line/column
  if (lower.callSpan) {
    // Check if lower's span is entirely within higher's span
    return (
      lower.callSpan.start >= higher.callSpan.start &&
      lower.callSpan.end <= higher.callSpan.end
    );
  }

  // Fallback: check if same file and lower's line is within higher's code
  // This is less precise but handles cases without callSpan
  if (higher.location.file !== lower.location.file) return false;

  // Count lines in the higher-priority code
  const higherLines = higher.code.split('\n').length;
  const higherEndLine = higher.location.line + higherLines - 1;

  return (
    lower.location.line >= higher.location.line &&
    lower.location.line <= higherEndLine
  );
}

/**
 * Create an analyzer issue for a hydration risk
 */
function createIssueForRisk(risk: HydrationRisk): AnalyzerIssue | undefined {
  switch (risk.type) {
    case 'date-render':
      return {
        category: 'hydration',
        severity: 'warning',
        message:
          'new Date() without arguments returns the current time, which differs between server render and client hydration',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Pass the current date from the loader to ensure server and client use the same value',
      };

    case 'locale-format': {
      const isDateSpecific =
        risk.code.includes('toLocaleDateString') ||
        risk.code.includes('toLocaleTimeString') ||
        risk.code.includes('Intl.DateTimeFormat');

      let message: string;
      let suggestion: string;

      if (isDateSpecific) {
        message =
          'Date formatting without explicit timeZone produces different results on server and client';
        suggestion =
          (risk.argCount ?? 0) >= 2
            ? 'Add timeZone to the existing options object, e.g. timeZone: "UTC"'
            : 'Add a timeZone option, e.g. toLocaleDateString(undefined, { timeZone: "UTC" })';
      } else {
        // .toLocaleString() -- could be Number or Date, can't tell from AST
        message =
          'Locale-dependent formatting may produce different results on server and client';
        suggestion =
          'Pass a fixed locale, e.g. .toLocaleString("en-US"), to ensure consistent output';
      }

      const issue: AnalyzerIssue = {
        category: 'hydration',
        severity: 'warning',
        message,
        location: risk.location,
        code: risk.code,
        suggestion,
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
        severity: 'warning',
        message: 'Random value in render will differ between server and client',
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
      return {
        category: 'hydration',
        severity: 'warning',
        message:
          'Browser-only API accessed during render is not available on the server',
        location: risk.location,
        code: risk.code,
        suggestion:
          'Move to useEffect, or guard with typeof window !== "undefined"',
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
