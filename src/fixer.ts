import * as fs from 'fs';
import type { AnalyzerIssue, TextEdit, FixResult } from './types.js';

/**
 * Apply fixes from issues to source files
 */
export function applyFixes(
  issues: AnalyzerIssue[],
  dryRun: boolean = false
): FixResult {
  const fixableIssues = issues.filter((i) => i.fix);
  const unfixableIssues = issues.filter((i) => !i.fix);

  // Group edits by file
  const editsByFile = new Map<
    string,
    { edit: TextEdit; issue: AnalyzerIssue }[]
  >();
  for (const issue of fixableIssues) {
    for (const edit of issue.fix!.edits) {
      const existing = editsByFile.get(edit.file) || [];
      existing.push({ edit, issue });
      editsByFile.set(edit.file, existing);
    }
  }

  const filesModified: string[] = [];
  const fixedIssues: AnalyzerIssue[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const [file, editsWithIssues] of editsByFile) {
    try {
      const edits = editsWithIssues.map((e) => e.edit);
      const result = applyEditsToFile(file, edits, dryRun);
      if (result.modified) {
        filesModified.push(file);
        // Track which issues were fixed
        for (const { issue } of editsWithIssues) {
          if (!fixedIssues.includes(issue)) {
            fixedIssues.push(issue);
          }
        }
      }
    } catch (e) {
      errors.push({ file, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    filesModified,
    fixesApplied: fixedIssues.length,
    fixedIssues,
    unfixableIssues,
    errors,
  };
}

/**
 * Apply multiple edits to a single file
 * Edits are applied in reverse order (highest offset first) to preserve positions
 */
function applyEditsToFile(
  file: string,
  edits: TextEdit[],
  dryRun: boolean
): { modified: boolean; newContent: string } {
  const content = fs.readFileSync(file, 'utf-8');

  // Sort edits by start position descending (apply from end to start)
  const sortedEdits = [...edits].sort((a, b) => b.start - a.start);

  // Check for overlapping edits
  for (let i = 0; i < sortedEdits.length - 1; i++) {
    const current = sortedEdits[i];
    const next = sortedEdits[i + 1];
    if (current.start < next.end) {
      throw new Error(
        `Overlapping edits at positions ${next.start}-${next.end} and ${current.start}-${current.end}`
      );
    }
  }

  // Apply edits
  let newContent = content;
  for (const edit of sortedEdits) {
    newContent =
      newContent.slice(0, edit.start) +
      edit.newText +
      newContent.slice(edit.end);
  }

  if (!dryRun && newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf-8');
    return { modified: true, newContent };
  }

  return { modified: newContent !== content, newContent };
}

/**
 * Get a preview of what would change for a single edit
 */
export function getEditPreview(
  file: string,
  edit: TextEdit,
  contextLines: number = 2
): { before: string; after: string; lineNumber: number } {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  // Find line containing the edit start
  let position = 0;
  let lineIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (position + lines[i].length >= edit.start) {
      lineIndex = i;
      break;
    }
    position += lines[i].length + 1; // +1 for newline
  }

  const startLine = Math.max(0, lineIndex - contextLines);
  const endLine = Math.min(lines.length - 1, lineIndex + contextLines);

  // Get before context
  const before = lines.slice(startLine, endLine + 1).join('\n');

  // Apply edit and get after context
  const newContent =
    content.slice(0, edit.start) + edit.newText + content.slice(edit.end);
  const newLines = newContent.split('\n');
  const after = newLines.slice(startLine, endLine + 1).join('\n');

  return {
    before,
    after,
    lineNumber: lineIndex + 1,
  };
}
