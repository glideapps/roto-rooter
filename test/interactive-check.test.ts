import { describe, it, expect } from 'vitest';
import { checkInteractive } from '../src/checks/interactive-check.js';

describe('interactive-check', () => {
  it('should return empty array (not yet implemented)', () => {
    // The interactive check is a placeholder that returns an empty array
    const issues = checkInteractive([]);
    expect(issues).toHaveLength(0);
  });
});
