import { distance } from 'fastest-levenshtein';

/**
 * Find the best matching suggestion from a list of candidates
 * Returns undefined if no good match is found
 */
export function findBestMatch(
  input: string,
  candidates: string[],
  maxDistance = 3
): string | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const d = distance(input, candidate);
    if (d < bestDistance && d <= maxDistance) {
      bestDistance = d;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Format a "Did you mean?" suggestion
 */
export function formatSuggestion(
  match: string | undefined
): string | undefined {
  if (!match) {
    return undefined;
  }
  return `Did you mean: ${match}?`;
}
