/**
 * SQL Extractor - Top-level orchestration
 *
 * This module coordinates SQL extraction across different ORMs.
 * ORM-specific logic is contained in src/sql/<orm>.ts files.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DrizzleSchema } from './types.js';
import { createDrizzleExtractor } from './sql/drizzle.js';
import type {
  ExtractedQuery,
  QueryParameter,
  SqlExtractionResult,
  SupportedOrm,
  OrmExtractor,
} from './sql/types.js';

// Re-export types for convenience
export type {
  ExtractedQuery,
  QueryParameter,
  SqlExtractionResult,
  SupportedOrm,
};

/**
 * Options for SQL extraction
 */
export interface SqlExtractorOptions {
  /** Root directory of the project */
  root: string;
  /** Specific files to analyze (empty = all route files) */
  files: string[];
  /** ORM type */
  orm?: SupportedOrm;
  /** Drizzle schema (required when orm is 'drizzle') */
  schema?: DrizzleSchema;
}

/**
 * Extract SQL queries from source files
 */
export function extractSqlQueries(
  options: SqlExtractorOptions
): SqlExtractionResult[] {
  const extractor = createExtractor(options);
  if (!extractor) {
    return [];
  }

  const results: SqlExtractionResult[] = [];
  const filesToAnalyze =
    options.files.length > 0 ? options.files : findRouteFiles(options.root);

  for (const file of filesToAnalyze) {
    const fullPath = path.isAbsolute(file)
      ? file
      : path.join(options.root, file);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    try {
      const queries = extractor.extractFromFile(fullPath);
      if (queries.length > 0) {
        results.push({
          file: fullPath,
          queries,
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return results;
}

/**
 * Create an ORM-specific extractor
 */
function createExtractor(
  options: SqlExtractorOptions
): OrmExtractor | undefined {
  const orm = options.orm || 'drizzle';

  switch (orm) {
    case 'drizzle':
      if (!options.schema) {
        return undefined;
      }
      return createDrizzleExtractor(options.schema);

    default:
      return undefined;
  }
}

/**
 * Find all route files in the project
 */
function findRouteFiles(root: string): string[] {
  const routesDir = path.join(root, 'app', 'routes');
  if (!fs.existsSync(routesDir)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(routesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.isFile() &&
      (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))
    ) {
      files.push(path.join(routesDir, entry.name));
    }
  }

  return files;
}

/**
 * Format extraction results as text
 */
export function formatSqlResultsText(
  results: SqlExtractionResult[],
  root: string
): string {
  if (results.length === 0) {
    return 'No SQL queries found.';
  }

  const lines: string[] = [];
  let totalQueries = 0;

  for (const result of results) {
    const relativePath = path.relative(root, result.file);

    for (const query of result.queries) {
      totalQueries++;
      lines.push(
        `File: ${relativePath}:${query.location.line}:${query.location.column}`
      );
      lines.push(`  ${query.sql}`);

      if (query.parameters.length > 0) {
        lines.push('  Parameters:');
        for (const param of query.parameters) {
          const typeInfo = param.columnType ? ` (${param.columnType})` : '';
          lines.push(`    $${param.position}: ${param.source}${typeInfo}`);
        }
      }

      lines.push('');
    }
  }

  lines.unshift(
    `Found ${totalQueries} SQL ${totalQueries === 1 ? 'query' : 'queries'}:\n`
  );

  return lines.join('\n');
}

/**
 * Format extraction results as JSON
 */
export function formatSqlResultsJson(
  results: SqlExtractionResult[],
  root: string
): object {
  const queries = results.flatMap((r) =>
    r.queries.map((q) => ({
      ...q,
      location: {
        ...q.location,
        file: path.relative(root, q.location.file),
      },
    }))
  );

  return {
    totalQueries: queries.length,
    queries,
  };
}
