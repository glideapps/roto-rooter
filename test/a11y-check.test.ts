import { describe, it, expect } from 'vitest';
import { checkA11y } from '../src/checks/a11y-check.js';

describe('a11y-check', () => {
  it('should return empty array (not yet implemented)', () => {
    // The a11y check is a placeholder that returns an empty array
    const issues = checkA11y([]);
    expect(issues).toHaveLength(0);
  });
});
