import type {
  AnalyzerIssue,
  DrizzleSchema,
  DrizzleTable,
  DrizzleColumn,
  DbOperation,
  DbColumnValue,
} from '../types.js';
import { extractDbOperations } from '../sql/drizzle-operations.js';
import {
  getTableByName,
  getEnumByName,
  getRequiredColumns,
  isNumericColumn,
  isEnumColumn,
} from '../parsers/drizzle-schema-parser.js';

/**
 * Check persistence operations against Drizzle schema
 */
export function checkPersistence(
  files: string[],
  schema: DrizzleSchema
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  for (const file of files) {
    try {
      const { operations } = extractDbOperations(file);

      for (const operation of operations) {
        const opIssues = validateOperation(operation, schema);
        issues.push(...opIssues);
      }
    } catch {
      // File doesn't exist or can't be parsed - skip it
    }
  }

  return issues;
}

/**
 * Validate a single database operation against the schema
 */
function validateOperation(
  operation: DbOperation,
  schema: DrizzleSchema
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  // Find the table in the schema
  const table = getTableByName(schema, operation.tableName);
  if (!table) {
    // Table not found in schema - skip validation
    // (could be imported from elsewhere or dynamic)
    return issues;
  }

  // Only validate inserts for missing required columns
  if (operation.type === 'insert') {
    const missingColumnIssues = checkMissingRequiredColumns(operation, table);
    issues.push(...missingColumnIssues);
  }

  // Check all column values for type/enum issues
  for (const colValue of operation.columnValues) {
    const column = table.columns.find((c) => c.name === colValue.columnName);
    if (!column) {
      // Column not found - skip (might be computed or dynamic)
      continue;
    }

    // Check for enum column receiving unvalidated external input
    if (isEnumColumn(column)) {
      const enumIssue = checkEnumValidation(
        colValue,
        column,
        operation,
        schema
      );
      if (enumIssue) {
        issues.push(enumIssue);
      }
    }

    // Check for type mismatch (string from formData to integer column)
    const typeIssue = checkTypeMismatch(colValue, column, operation);
    if (typeIssue) {
      issues.push(typeIssue);
    }
  }

  return issues;
}

/**
 * Check if an insert operation is missing required columns
 */
function checkMissingRequiredColumns(
  operation: DbOperation,
  table: DrizzleTable
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  const requiredColumns = getRequiredColumns(table);
  const providedColumns = new Set(
    operation.columnValues.map((cv) => cv.columnName)
  );

  for (const requiredCol of requiredColumns) {
    if (!providedColumns.has(requiredCol.name)) {
      issues.push({
        category: 'drizzle',
        severity: 'error',
        message: `db.insert(${operation.tableName}) missing required column '${requiredCol.name}'`,
        location: operation.location,
        code: `db.insert(${operation.tableName}).values({...})`,
        suggestion: `Add '${requiredCol.name}' to the values object`,
      });
    }
  }

  return issues;
}

/**
 * Check if an enum column receives unvalidated external input
 */
function checkEnumValidation(
  colValue: DbColumnValue,
  column: DrizzleColumn,
  operation: DbOperation,
  schema: DrizzleSchema
): AnalyzerIssue | undefined {
  const source = colValue.dataSource;

  // Skip if already validated (via zod or similar)
  if (source.isValidated) {
    return undefined;
  }

  // Skip if it's a literal value (will be type-checked by TypeScript)
  if (source.source === 'literal') {
    return undefined;
  }

  // Skip if it's from an unknown/internal source
  if (source.source === 'variable' || source.source === 'unknown') {
    return undefined;
  }

  // Flag if it's from formData, params, or body without validation
  if (
    source.source === 'formData' ||
    source.source === 'params' ||
    source.source === 'body'
  ) {
    const enumDef = column.enumName
      ? getEnumByName(schema, column.enumName)
      : undefined;
    const allowedValues =
      enumDef?.values.map((v) => `'${v}'`).join(', ') || 'enum values';

    return {
      category: 'drizzle',
      severity: 'error',
      message: `Enum column '${column.name}' receives unvalidated external input`,
      location: operation.location,
      code: `${colValue.columnName}: ${source.source}.get('${source.fieldName || colValue.columnName}')`,
      suggestion: `Validate with zod schema or check against allowed values: ${allowedValues}`,
    };
  }

  return undefined;
}

/**
 * Check for type mismatch between data source and column type
 */
function checkTypeMismatch(
  colValue: DbColumnValue,
  column: DrizzleColumn,
  operation: DbOperation
): AnalyzerIssue | undefined {
  const source = colValue.dataSource;

  // Skip if already validated (type coercion would happen in validation)
  if (source.isValidated) {
    return undefined;
  }

  // Skip literals (will be type-checked by TypeScript)
  if (source.source === 'literal') {
    return undefined;
  }

  // Check for string being passed to numeric column
  if (isNumericColumn(column) && source.type === 'string') {
    // formData.get() returns string, but column expects number
    if (source.source === 'formData' || source.source === 'params') {
      return {
        category: 'drizzle',
        severity: 'error',
        message: `Column '${column.name}' expects ${column.type} but receives string from ${source.source}.get()`,
        location: operation.location,
        code: `${colValue.columnName}: ${source.source}.get('${source.fieldName || colValue.columnName}')`,
        suggestion: `Convert with parseInt(${colValue.columnName}, 10) or Number(${colValue.columnName})`,
      };
    }
  }

  // Check for string being passed to boolean column
  if (column.type === 'boolean' && source.type === 'string') {
    if (source.source === 'formData' || source.source === 'params') {
      return {
        category: 'drizzle',
        severity: 'error',
        message: `Column '${column.name}' expects boolean but receives string from ${source.source}.get()`,
        location: operation.location,
        code: `${colValue.columnName}: ${source.source}.get('${source.fieldName || colValue.columnName}')`,
        suggestion: `Convert with Boolean(${colValue.columnName}) or ${colValue.columnName} === 'true'`,
      };
    }
  }

  return undefined;
}
