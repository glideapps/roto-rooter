/**
 * Drizzle ORM SQL extraction
 *
 * This module extracts SQL queries from Drizzle ORM code patterns like:
 * - db.select().from(table).where(...)
 * - db.insert(table).values({...})
 * - db.update(table).set({...}).where(...)
 * - db.delete(table).where(...)
 */

import * as fs from 'fs';
import ts from 'typescript';
import { parseFile, walkAst, getLineAndColumn } from '../utils/ast-utils.js';
import type { DrizzleSchema } from '../types.js';
import { getTableByName } from '../parsers/drizzle-schema-parser.js';
import type { ExtractedQuery, QueryParameter, OrmExtractor } from './types.js';

// ============================================================================
// Internal Types
// ============================================================================

interface DbChainInfo {
  operation: 'select' | 'insert' | 'update' | 'delete';
  tableName: string;
  selectColumns?: string[];
  insertValues?: Map<string, ValueInfo>;
  setValues?: Map<string, ValueInfo>;
  whereConditions?: WhereCondition[];
  joins?: JoinInfo[];
  groupBy?: GroupByColumn[];
  orderBy?: OrderByInfo[];
  limit?: number;
  offset?: number;
}

interface ValueInfo {
  type: 'literal' | 'param' | 'variable';
  value?: string | number | boolean;
  source?: string;
  dataType?: string;
}

interface WhereCondition {
  column: string;
  operator: string;
  value: ValueInfo;
}

interface JoinOnCondition {
  leftTable: string;
  leftColumn: string;
  operator: string;
  rightTable: string;
  rightColumn: string;
}

interface JoinInfo {
  type: 'inner' | 'left' | 'right' | 'full';
  table: string;
  onConditions: JoinOnCondition[];
}

interface GroupByColumn {
  table: string;
  column: string;
}

interface OrderByInfo {
  column: string;
  direction: 'asc' | 'desc';
}

interface GeneratedSql {
  type: ExtractedQuery['type'];
  sql: string;
  tables: string[];
  parameters: QueryParameter[];
}

// ============================================================================
// Drizzle Extractor
// ============================================================================

/**
 * Create a Drizzle ORM extractor
 */
export function createDrizzleExtractor(schema: DrizzleSchema): OrmExtractor {
  return {
    extractFromFile(filePath: string): ExtractedQuery[] {
      return extractQueriesFromFile(filePath, schema);
    },
  };
}

/**
 * Extract all queries from a single file
 */
function extractQueriesFromFile(
  filePath: string,
  schema: DrizzleSchema
): ExtractedQuery[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseFile(filePath, content);
  const queries: ExtractedQuery[] = [];

  // Track db variable names (could be imported as different names)
  const dbVariables = new Set<string>(['db']);

  // Build import alias map: local name -> original export name
  // e.g., import { tasks as tasksTable } -> "tasksTable" -> "tasks"
  const importAliases = new Map<string, string>();

  // First pass: find db imports/variables and import aliases
  walkAst(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      if (ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          if (
            element.propertyName?.text === 'db' ||
            element.name.text === 'db'
          ) {
            dbVariables.add(element.name.text);
          }
          if (element.propertyName) {
            // { original as alias } -> map alias to original
            importAliases.set(element.name.text, element.propertyName.text);
          }
        }
      }
    }
  });

  // Second pass: find db operations
  // Only process CallExpressions that are the END of a method chain
  walkAst(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      // Skip if this call is part of another method chain
      const parent = node.parent;
      if (
        ts.isPropertyAccessExpression(parent) &&
        ts.isCallExpression(parent.parent)
      ) {
        return;
      }

      const query = parseDbQuery(
        node,
        sourceFile,
        filePath,
        content,
        schema,
        dbVariables,
        importAliases
      );
      if (query) {
        queries.push(query);
      }
    }
  });

  // Deduplicate by line number
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = `${q.location.line}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Parse a db query from an AST node
 */
function parseDbQuery(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
  content: string,
  schema: DrizzleSchema,
  dbVariables: Set<string>,
  importAliases: Map<string, string>
): ExtractedQuery | undefined {
  let expr: ts.Node = node;
  if (ts.isAwaitExpression(expr)) {
    expr = expr.expression;
  }

  if (!ts.isCallExpression(expr)) {
    return undefined;
  }

  const chainInfo = analyzeDbChain(expr, dbVariables);
  if (!chainInfo) {
    return undefined;
  }

  const loc = getLineAndColumn(sourceFile, node.getStart(sourceFile));
  const codeSnippet = getCodeSnippet(
    content,
    node.getStart(sourceFile),
    node.getEnd()
  );

  // Resolve import aliases for table name (e.g., tasksTable -> tasks)
  chainInfo.tableName =
    importAliases.get(chainInfo.tableName) || chainInfo.tableName;
  if (chainInfo.joins) {
    for (const join of chainInfo.joins) {
      join.table = importAliases.get(join.table) || join.table;
      for (const cond of join.onConditions) {
        cond.leftTable = importAliases.get(cond.leftTable) || cond.leftTable;
        cond.rightTable = importAliases.get(cond.rightTable) || cond.rightTable;
      }
    }
  }
  if (chainInfo.groupBy) {
    for (const col of chainInfo.groupBy) {
      col.table = importAliases.get(col.table) || col.table;
    }
  }

  const query = generateSql(chainInfo, schema);
  if (!query) {
    return undefined;
  }

  return {
    type: query.type,
    sql: query.sql,
    tables: query.tables,
    location: {
      file: filePath,
      line: loc.line,
      column: loc.column,
    },
    code: codeSnippet,
    parameters: query.parameters,
  };
}

// ============================================================================
// Chain Analysis
// ============================================================================

/**
 * Analyze a db method chain to extract operation details
 */
function analyzeDbChain(
  callExpr: ts.CallExpression,
  dbVariables: Set<string>
): DbChainInfo | undefined {
  const chain = collectMethodChain(callExpr);

  let operationInfo: { operation: string; tableName: string } | undefined;

  for (let i = 0; i < chain.length; i++) {
    const { object, method, args } = chain[i];

    if (ts.isIdentifier(object) && dbVariables.has(object.text)) {
      if (['select', 'insert', 'update', 'delete'].includes(method)) {
        let tableName = '';

        if (method === 'select') {
          const fromCall = chain.find((c) => c.method === 'from');
          if (fromCall && fromCall.args.length > 0) {
            tableName = getTableNameFromArg(fromCall.args[0]);
          }
        } else if (args.length > 0) {
          tableName = getTableNameFromArg(args[0]);
        }

        if (tableName || method === 'select') {
          operationInfo = { operation: method, tableName: tableName || '' };
          break;
        }
      }
    }

    if (ts.isCallExpression(object)) {
      const innerChain = collectMethodChain(object);
      for (const inner of innerChain) {
        if (
          ts.isIdentifier(inner.object) &&
          dbVariables.has(inner.object.text)
        ) {
          if (['select', 'insert', 'update', 'delete'].includes(inner.method)) {
            const tableName =
              inner.args.length > 0 ? getTableNameFromArg(inner.args[0]) : '';
            operationInfo = { operation: inner.method, tableName };
            break;
          }
        }
      }
    }
  }

  if (!operationInfo) {
    return undefined;
  }

  const info: DbChainInfo = {
    operation: operationInfo.operation as DbChainInfo['operation'],
    tableName: operationInfo.tableName,
  };

  for (const { method, args } of chain) {
    switch (method) {
      case 'select':
        if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
          info.selectColumns = extractSelectColumns(args[0]);
        }
        break;

      case 'from':
        if (args.length > 0 && !info.tableName) {
          info.tableName = getTableNameFromArg(args[0]);
        }
        break;

      case 'values':
        if (args.length > 0) {
          info.insertValues = extractObjectValues(args[0]);
        }
        break;

      case 'set':
        if (args.length > 0) {
          info.setValues = extractObjectValues(args[0]);
        }
        break;

      case 'where':
        if (args.length > 0) {
          const conditions = extractWhereConditions(args[0]);
          info.whereConditions = [
            ...(info.whereConditions || []),
            ...conditions,
          ];
        }
        break;

      case 'innerJoin':
      case 'leftJoin':
      case 'rightJoin':
      case 'fullJoin':
        if (args.length >= 2) {
          const joinType = method.replace('Join', '') as JoinInfo['type'];
          info.joins = [
            ...(info.joins || []),
            {
              type: joinType,
              table: getTableNameFromArg(args[0]),
              onConditions: extractJoinOnConditions(args[1]),
            },
          ];
        }
        break;

      case 'groupBy':
        if (args.length > 0) {
          info.groupBy = extractGroupByColumns(args);
        }
        break;

      case 'orderBy':
        if (args.length > 0) {
          info.orderBy = extractOrderBy(args);
        }
        break;

      case 'limit':
        if (args.length > 0 && ts.isNumericLiteral(args[0])) {
          info.limit = Number(args[0].text);
        }
        break;

      case 'offset':
        if (args.length > 0 && ts.isNumericLiteral(args[0])) {
          info.offset = Number(args[0].text);
        }
        break;
    }
  }

  return info;
}

/**
 * Collect all method calls in a chain
 */
function collectMethodChain(
  expr: ts.CallExpression
): Array<{ object: ts.Expression; method: string; args: ts.Expression[] }> {
  const chain: Array<{
    object: ts.Expression;
    method: string;
    args: ts.Expression[];
  }> = [];
  let current: ts.Expression = expr;

  while (ts.isCallExpression(current)) {
    const callExpr = current.expression;

    if (ts.isPropertyAccessExpression(callExpr)) {
      chain.unshift({
        object: callExpr.expression,
        method: callExpr.name.text,
        args: Array.from(current.arguments),
      });
      current = callExpr.expression;
    } else if (ts.isIdentifier(callExpr)) {
      break;
    } else {
      break;
    }
  }

  return chain;
}

// ============================================================================
// Value Extraction
// ============================================================================

function getTableNameFromArg(arg: ts.Expression): string {
  if (ts.isIdentifier(arg)) {
    return arg.text;
  }
  if (ts.isPropertyAccessExpression(arg)) {
    return arg.name.text;
  }
  return '';
}

function extractSelectColumns(arg: ts.ObjectLiteralExpression): string[] {
  const columns: string[] = [];

  for (const prop of arg.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const key = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined;
      if (key) {
        columns.push(key);
      }
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      columns.push(prop.name.text);
    }
  }

  return columns;
}

function extractObjectValues(arg: ts.Expression): Map<string, ValueInfo> {
  const values = new Map<string, ValueInfo>();

  if (!ts.isObjectLiteralExpression(arg)) {
    return values;
  }

  for (const prop of arg.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const key = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined;

      if (key) {
        values.set(key, analyzeValue(prop.initializer));
      }
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      values.set(prop.name.text, { type: 'variable', source: prop.name.text });
    }
  }

  return values;
}

function analyzeValue(expr: ts.Expression): ValueInfo {
  if (ts.isStringLiteral(expr)) {
    return { type: 'literal', value: expr.text, dataType: 'string' };
  }
  if (ts.isNumericLiteral(expr)) {
    return { type: 'literal', value: Number(expr.text), dataType: 'number' };
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return { type: 'literal', value: true, dataType: 'boolean' };
  }
  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return { type: 'literal', value: false, dataType: 'boolean' };
  }
  if (expr.kind === ts.SyntaxKind.NullKeyword) {
    return { type: 'literal', value: 'NULL', dataType: 'null' };
  }

  if (ts.isIdentifier(expr)) {
    return { type: 'variable', source: expr.text };
  }

  if (ts.isCallExpression(expr)) {
    const callText = expr.getText();
    if (callText.includes('formData.get')) {
      const fieldArg = expr.arguments[0];
      const fieldName = ts.isStringLiteral(fieldArg)
        ? fieldArg.text
        : 'unknown';
      return {
        type: 'param',
        source: `formData.get('${fieldName}')`,
        dataType: 'string',
      };
    }
    if (callText.includes('Number(') || callText.includes('parseInt(')) {
      return { type: 'param', source: callText, dataType: 'number' };
    }
  }

  if (ts.isPropertyAccessExpression(expr)) {
    const text = expr.getText();
    if (text.startsWith('params.')) {
      return { type: 'param', source: text, dataType: 'string' };
    }
    if (text.startsWith('data.')) {
      return { type: 'param', source: text, dataType: 'unknown' };
    }
  }

  return { type: 'param', source: expr.getText() };
}

// ============================================================================
// WHERE Clause Extraction
// ============================================================================

function extractWhereConditions(expr: ts.Expression): WhereCondition[] {
  const conditions: WhereCondition[] = [];

  if (ts.isCallExpression(expr)) {
    const funcExpr = expr.expression;

    if (ts.isIdentifier(funcExpr)) {
      const operator = funcExpr.text;
      const operatorMap: Record<string, string> = {
        eq: '=',
        ne: '!=',
        lt: '<',
        lte: '<=',
        gt: '>',
        gte: '>=',
        like: 'LIKE',
        ilike: 'ILIKE',
        isNull: 'IS NULL',
        isNotNull: 'IS NOT NULL',
        inArray: 'IN',
        notInArray: 'NOT IN',
      };

      if (operatorMap[operator] && expr.arguments.length >= 1) {
        const columnArg = expr.arguments[0];
        const columnName = getColumnNameFromExpr(columnArg);

        if (operator === 'isNull' || operator === 'isNotNull') {
          conditions.push({
            column: columnName,
            operator: operatorMap[operator],
            value: { type: 'literal', value: '' },
          });
        } else if (expr.arguments.length >= 2) {
          const valueArg = expr.arguments[1];
          conditions.push({
            column: columnName,
            operator: operatorMap[operator],
            value: analyzeValue(valueArg),
          });
        }
      }

      if (operator === 'and' || operator === 'or') {
        for (const arg of expr.arguments) {
          conditions.push(...extractWhereConditions(arg));
        }
      }
    }
  }

  return conditions;
}

function getColumnNameFromExpr(expr: ts.Expression): string {
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text;
  }
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  return expr.getText();
}

// ============================================================================
// JOIN ON Extraction
// ============================================================================

function extractJoinOnConditions(expr: ts.Expression): JoinOnCondition[] {
  const conditions: JoinOnCondition[] = [];

  if (ts.isCallExpression(expr)) {
    const funcExpr = expr.expression;

    if (ts.isIdentifier(funcExpr)) {
      const operator = funcExpr.text;
      const operatorMap: Record<string, string> = {
        eq: '=',
        ne: '!=',
        lt: '<',
        lte: '<=',
        gt: '>',
        gte: '>=',
      };

      if (operatorMap[operator] && expr.arguments.length >= 2) {
        const left = extractColumnRef(expr.arguments[0]);
        const right = extractColumnRef(expr.arguments[1]);
        if (left && right) {
          conditions.push({
            leftTable: left.table,
            leftColumn: left.column,
            operator: operatorMap[operator],
            rightTable: right.table,
            rightColumn: right.column,
          });
        }
      }

      if (operator === 'and' || operator === 'or') {
        for (const arg of expr.arguments) {
          conditions.push(...extractJoinOnConditions(arg));
        }
      }
    }
  }

  return conditions;
}

function extractColumnRef(
  expr: ts.Expression
): { table: string; column: string } | undefined {
  if (ts.isPropertyAccessExpression(expr)) {
    const table = getTableNameFromArg(expr.expression);
    const column = expr.name.text;
    if (table) {
      return { table, column };
    }
  }
  return undefined;
}

// ============================================================================
// GROUP BY Extraction
// ============================================================================

function extractGroupByColumns(
  args: readonly ts.Expression[]
): GroupByColumn[] {
  const columns: GroupByColumn[] = [];

  for (const arg of args) {
    const ref = extractColumnRef(arg);
    if (ref) {
      columns.push({ table: ref.table, column: ref.column });
    }
  }

  return columns;
}

// ============================================================================
// ORDER BY Extraction
// ============================================================================

function extractOrderBy(args: readonly ts.Expression[]): OrderByInfo[] {
  const orderBy: OrderByInfo[] = [];

  for (const arg of args) {
    if (ts.isCallExpression(arg)) {
      const funcExpr = arg.expression;
      if (ts.isIdentifier(funcExpr)) {
        const direction = funcExpr.text === 'desc' ? 'desc' : 'asc';
        if (arg.arguments.length > 0) {
          const colExpr = arg.arguments[0];
          const column = getColumnNameFromExpr(colExpr);
          orderBy.push({ column, direction });
        }
      }
    } else {
      const column = getColumnNameFromExpr(arg);
      if (column) {
        orderBy.push({ column, direction: 'asc' });
      }
    }
  }

  return orderBy;
}

// ============================================================================
// SQL Generation
// ============================================================================

function generateSql(
  info: DbChainInfo,
  schema: DrizzleSchema
): GeneratedSql | undefined {
  const table = getTableByName(schema, info.tableName);
  const tableSqlName = table?.sqlName || info.tableName;
  const tables = [tableSqlName];
  const parameters: QueryParameter[] = [];
  let paramCounter = 1;

  const getColumnType = (colName: string): string | undefined => {
    if (table) {
      const col = table.columns.find((c) => c.name === colName);
      if (col) {
        return col.type;
      }
    }
    return undefined;
  };

  const formatValue = (val: ValueInfo, colName?: string): string => {
    if (val.type === 'literal') {
      if (val.dataType === 'string') {
        return `'${String(val.value).replace(/'/g, "''")}'`;
      }
      if (val.dataType === 'null') {
        return 'NULL';
      }
      return String(val.value);
    }
    const columnType = colName ? getColumnType(colName) : undefined;
    parameters.push({
      position: paramCounter,
      source: val.source || 'unknown',
      columnType,
    });
    return `$${paramCounter++}`;
  };

  const formatColumn = (colName: string): string => {
    if (table) {
      const col = table.columns.find((c) => c.name === colName);
      if (col) {
        return col.sqlName;
      }
    }
    return colName;
  };

  switch (info.operation) {
    case 'select': {
      let sql = 'SELECT';

      if (info.selectColumns && info.selectColumns.length > 0) {
        sql += ' ' + info.selectColumns.map(formatColumn).join(', ');
      } else {
        sql += ' *';
      }

      sql += ` FROM ${tableSqlName}`;

      if (info.joins) {
        for (const join of info.joins) {
          const joinTable = getTableByName(schema, join.table);
          const joinTableName = joinTable?.sqlName || join.table;
          tables.push(joinTableName);

          const onClause = join.onConditions
            .map((cond) => {
              const lt = getTableByName(schema, cond.leftTable);
              const ltName = lt?.sqlName || cond.leftTable;
              const ltCol =
                lt?.columns.find((c) => c.name === cond.leftColumn)?.sqlName ||
                cond.leftColumn;
              const rt = getTableByName(schema, cond.rightTable);
              const rtName = rt?.sqlName || cond.rightTable;
              const rtCol =
                rt?.columns.find((c) => c.name === cond.rightColumn)?.sqlName ||
                cond.rightColumn;
              return `${ltName}.${ltCol} ${cond.operator} ${rtName}.${rtCol}`;
            })
            .join(' AND ');

          sql += ` ${join.type.toUpperCase()} JOIN ${joinTableName} ON ${onClause}`;
        }
      }

      if (info.whereConditions && info.whereConditions.length > 0) {
        const whereClause = info.whereConditions
          .map((c) => {
            const col = formatColumn(c.column);
            if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
              return `${col} ${c.operator}`;
            }
            return `${col} ${c.operator} ${formatValue(c.value, c.column)}`;
          })
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
      }

      if (info.groupBy && info.groupBy.length > 0) {
        const groupClause = info.groupBy
          .map((g) => {
            const t = getTableByName(schema, g.table);
            const tName = t?.sqlName || g.table;
            const col =
              t?.columns.find((c) => c.name === g.column)?.sqlName || g.column;
            return `${tName}.${col}`;
          })
          .join(', ');
        sql += ` GROUP BY ${groupClause}`;
      }

      if (info.orderBy && info.orderBy.length > 0) {
        const orderClause = info.orderBy
          .map((o) => `${formatColumn(o.column)} ${o.direction.toUpperCase()}`)
          .join(', ');
        sql += ` ORDER BY ${orderClause}`;
      }

      if (info.limit !== undefined) {
        sql += ` LIMIT ${info.limit}`;
      }

      if (info.offset !== undefined) {
        sql += ` OFFSET ${info.offset}`;
      }

      return { type: 'SELECT', sql, tables, parameters };
    }

    case 'insert': {
      if (!info.insertValues || info.insertValues.size === 0) {
        return undefined;
      }

      const columns: string[] = [];
      const values: string[] = [];

      for (const [col, val] of info.insertValues) {
        columns.push(formatColumn(col));
        values.push(formatValue(val, col));
      }

      const sql = `INSERT INTO ${tableSqlName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
      return { type: 'INSERT', sql, tables, parameters };
    }

    case 'update': {
      if (!info.setValues || info.setValues.size === 0) {
        return undefined;
      }

      const setClause = Array.from(info.setValues.entries())
        .map(([col, val]) => `${formatColumn(col)} = ${formatValue(val, col)}`)
        .join(', ');

      let sql = `UPDATE ${tableSqlName} SET ${setClause}`;

      if (info.whereConditions && info.whereConditions.length > 0) {
        const whereClause = info.whereConditions
          .map((c) => {
            const col = formatColumn(c.column);
            if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
              return `${col} ${c.operator}`;
            }
            return `${col} ${c.operator} ${formatValue(c.value, c.column)}`;
          })
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
      }

      return { type: 'UPDATE', sql, tables, parameters };
    }

    case 'delete': {
      let sql = `DELETE FROM ${tableSqlName}`;

      if (info.whereConditions && info.whereConditions.length > 0) {
        const whereClause = info.whereConditions
          .map((c) => {
            const col = formatColumn(c.column);
            if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
              return `${col} ${c.operator}`;
            }
            return `${col} ${c.operator} ${formatValue(c.value, c.column)}`;
          })
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
      }

      return { type: 'DELETE', sql, tables, parameters };
    }
  }

  return undefined;
}

// ============================================================================
// Utilities
// ============================================================================

function getCodeSnippet(content: string, start: number, end: number): string {
  const snippet = content.slice(start, end);
  return snippet.replace(/\s+/g, ' ').trim();
}
