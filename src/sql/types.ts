import type { SourceLocation } from '../types.js';

/**
 * Represents a SQL query extracted from code
 */
export interface ExtractedQuery {
  /** Type of operation */
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  /** Generated SQL statement */
  sql: string;
  /** Table name(s) involved */
  tables: string[];
  /** Source location in the code */
  location: SourceLocation;
  /** Original code snippet */
  code: string;
  /** Parameters used in the query (for parameterized values) */
  parameters: QueryParameter[];
}

/**
 * A parameter in a parameterized query
 */
export interface QueryParameter {
  /** Position in query ($1, $2, etc.) */
  position: number;
  /** Source of the value (variable name or expression) */
  source: string;
  /** Expected column type from schema */
  columnType?: string;
}

/**
 * Result of extracting SQL queries from a file
 */
export interface SqlExtractionResult {
  /** File that was analyzed */
  file: string;
  /** Extracted queries */
  queries: ExtractedQuery[];
}

/**
 * Supported ORM types
 */
export type SupportedOrm = 'drizzle';

/**
 * Interface that all ORM extractors must implement
 */
export interface OrmExtractor {
  /** Extract queries from a single file */
  extractFromFile(filePath: string): ExtractedQuery[];
}
