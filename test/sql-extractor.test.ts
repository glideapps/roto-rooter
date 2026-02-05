import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  extractSqlQueries,
  formatSqlResultsText,
  formatSqlResultsJson,
} from '../src/sql-extractor.js';
import { parseDrizzleSchema } from '../src/parsers/drizzle-schema-parser.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');
const schemaPath = path.join(fixturesDir, 'db/schema.ts');

describe('sql-extractor', () => {
  const schema = parseDrizzleSchema(schemaPath);

  describe('extractSqlQueries', () => {
    it('should extract INSERT statements', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      expect(results).toHaveLength(1);
      const queries = results[0].queries;

      const insertQueries = queries.filter((q) => q.type === 'INSERT');
      expect(insertQueries.length).toBeGreaterThan(0);

      // Check for user insert
      const userInsert = insertQueries.find((q) =>
        q.sql.includes('INSERT INTO users')
      );
      expect(userInsert).toBeDefined();
      expect(userInsert!.sql).toContain('name');
      expect(userInsert!.sql).toContain('email');
      expect(userInsert!.sql).toContain('status');
    });

    it('should extract UPDATE statements with WHERE clause', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;
      const updateQueries = queries.filter((q) => q.type === 'UPDATE');
      expect(updateQueries.length).toBeGreaterThan(0);

      // Check for update with where
      const updateWithWhere = updateQueries.find(
        (q) => q.sql.includes('UPDATE users') && q.sql.includes('WHERE')
      );
      expect(updateWithWhere).toBeDefined();
    });

    it('should extract DELETE statements', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;
      const deleteQueries = queries.filter((q) => q.type === 'DELETE');
      expect(deleteQueries.length).toBeGreaterThan(0);

      // Check for delete with where
      const deleteWithWhere = deleteQueries.find(
        (q) => q.sql.includes('DELETE FROM users') && q.sql.includes('WHERE')
      );
      expect(deleteWithWhere).toBeDefined();

      // Check for inline delete button pattern (delete-order)
      const deleteOrder = deleteQueries.find((q) =>
        q.sql.includes('DELETE FROM orders')
      );
      expect(deleteOrder).toBeDefined();
    });

    it('should extract form-based destructive operations', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;

      // Archive pattern (soft delete via UPDATE)
      const archiveUpdate = queries.find(
        (q) =>
          q.type === 'UPDATE' &&
          q.sql.includes('users') &&
          q.sql.includes('archived')
      );
      expect(archiveUpdate).toBeDefined();

      // Batch update pattern (complete-orders)
      const batchUpdate = queries.find(
        (q) =>
          q.type === 'UPDATE' &&
          q.sql.includes('orders') &&
          q.sql.includes('completed')
      );
      expect(batchUpdate).toBeDefined();
    });

    it('should extract SELECT statements', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;
      const selectQueries = queries.filter((q) => q.type === 'SELECT');
      expect(selectQueries.length).toBeGreaterThan(0);

      // Check for simple select
      const simpleSelect = selectQueries.find(
        (q) => q.sql.includes('SELECT * FROM users') && !q.sql.includes('WHERE')
      );
      expect(simpleSelect).toBeDefined();

      // Check for select with where
      const selectWithWhere = selectQueries.find(
        (q) => q.sql.includes('SELECT * FROM users') && q.sql.includes('WHERE')
      );
      expect(selectWithWhere).toBeDefined();
    });

    it('should track parameters for dynamic values', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;

      // Find a query with parameters
      const queryWithParams = queries.find((q) => q.parameters.length > 0);
      expect(queryWithParams).toBeDefined();
      expect(queryWithParams!.parameters[0].position).toBe(1);
      expect(queryWithParams!.parameters[0].source).toBeTruthy();
    });

    it('should handle literal values correctly', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;

      // Find insert with inline literal status value
      // The create-order insert has status: 'active' as an inline literal
      const insertWithLiteral = queries.find(
        (q) =>
          q.type === 'INSERT' &&
          q.sql.includes('orders') &&
          q.sql.includes("'active'")
      );
      expect(insertWithLiteral).toBeDefined();
    });

    it('should include source location', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;
      expect(queries.length).toBeGreaterThan(0);

      for (const query of queries) {
        expect(query.location.file).toBeTruthy();
        expect(query.location.line).toBeGreaterThan(0);
        expect(query.location.column).toBeGreaterThan(0);
      }
    });

    it('should extract queries from existing fixture files', () => {
      // Test against user-create.tsx which has a simple insert
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/user-create.tsx')],
        schema,
      });

      expect(results).toHaveLength(1);
      const queries = results[0].queries;
      expect(queries).toHaveLength(1);
      expect(queries[0].type).toBe('INSERT');
      expect(queries[0].sql).toContain('INSERT INTO users');
    });
  });

  describe('formatSqlResultsText', () => {
    it('should format results as readable text', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/user-create.tsx')],
        schema,
      });

      const output = formatSqlResultsText(results, fixturesDir);

      expect(output).toContain('Found');
      expect(output).toContain('SQL');
      expect(output).toContain('INSERT INTO users');
    });

    it('should show parameters in text output', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const output = formatSqlResultsText(results, fixturesDir);

      expect(output).toContain('Parameters:');
      expect(output).toContain('$1');
    });

    it('should return message when no queries found', () => {
      const output = formatSqlResultsText([], fixturesDir);
      expect(output).toBe('No SQL queries found.');
    });
  });

  describe('formatSqlResultsJson', () => {
    it('should format results as JSON', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/user-create.tsx')],
        schema,
      });

      const output = formatSqlResultsJson(results, fixturesDir) as {
        totalQueries: number;
        queries: Array<{ type: string; sql: string }>;
      };

      expect(output.totalQueries).toBe(1);
      expect(output.queries).toHaveLength(1);
      expect(output.queries[0].type).toBe('INSERT');
      expect(output.queries[0].sql).toBeTruthy();
    });

    it('should use relative paths in JSON output', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/user-create.tsx')],
        schema,
      });

      const output = formatSqlResultsJson(results, fixturesDir) as {
        queries: Array<{ location: { file: string } }>;
      };

      expect(output.queries[0].location.file).toBe(
        'app/routes/user-create.tsx'
      );
    });
  });

  describe('SQL generation accuracy', () => {
    it('should generate correct INSERT syntax', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/order-create.tsx')],
        schema,
      });

      const queries = results[0].queries;
      const insert = queries.find((q) => q.type === 'INSERT');

      expect(insert).toBeDefined();
      // Should match INSERT INTO tablename (cols) VALUES (vals)
      expect(insert!.sql).toMatch(/INSERT INTO orders \(.+\) VALUES \(.+\)/);
    });

    it('should handle boolean and null values', () => {
      const results = extractSqlQueries({
        root: fixturesDir,
        files: [path.join(fixturesDir, 'app/routes/sql-operations.tsx')],
        schema,
      });

      const queries = results[0].queries;

      // Find update that sets isActive to false
      const updateWithBool = queries.find(
        (q) =>
          q.type === 'UPDATE' &&
          (q.sql.includes('is_active = false') ||
            q.sql.includes('isActive = false'))
      );
      expect(updateWithBool).toBeDefined();
    });
  });
});
