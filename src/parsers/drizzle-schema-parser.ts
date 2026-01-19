import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import type {
  DrizzleSchema,
  DrizzleTable,
  DrizzleColumn,
  DrizzleColumnType,
  DrizzleEnum,
} from '../types.js';
import { parseFile, walkAst } from '../utils/ast-utils.js';

/**
 * Common locations where Drizzle schemas are typically found
 */
const SCHEMA_DISCOVERY_PATHS = [
  'src/db/schema.ts',
  'db/schema.ts',
  'lib/db/schema.ts',
  'src/schema.ts',
  'app/db/schema.ts',
  'server/db/schema.ts',
];

/**
 * Auto-discover the Drizzle schema file location
 */
export function discoverSchemaPath(rootDir: string): string | undefined {
  // Check common locations
  for (const relativePath of SCHEMA_DISCOVERY_PATHS) {
    const fullPath = path.join(rootDir, relativePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Try to parse drizzle.config.ts for custom schema path
  const configPaths = [
    path.join(rootDir, 'drizzle.config.ts'),
    path.join(rootDir, 'drizzle.config.js'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const schemaPath = parseSchemaPathFromConfig(configPath, rootDir);
      if (schemaPath && fs.existsSync(schemaPath)) {
        return schemaPath;
      }
    }
  }

  return undefined;
}

/**
 * Parse the schema path from drizzle.config.ts
 */
function parseSchemaPathFromConfig(
  configPath: string,
  rootDir: string
): string | undefined {
  const content = fs.readFileSync(configPath, 'utf-8');
  const sourceFile = parseFile(configPath, content);

  let schemaPath: string | undefined;

  walkAst(sourceFile, (node) => {
    // Look for: schema: "./src/db/schema.ts" or schema: ["./src/db/schema.ts"]
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) ? node.name.text : undefined;
      if (name === 'schema') {
        if (ts.isStringLiteral(node.initializer)) {
          schemaPath = path.resolve(rootDir, node.initializer.text);
        } else if (ts.isArrayLiteralExpression(node.initializer)) {
          // Take first element if array
          const first = node.initializer.elements[0];
          if (first && ts.isStringLiteral(first)) {
            schemaPath = path.resolve(rootDir, first.text);
          }
        }
      }
    }
  });

  return schemaPath;
}

/**
 * Parse a Drizzle schema file and extract table/column/enum definitions
 */
export function parseDrizzleSchema(schemaPath: string): DrizzleSchema {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Drizzle schema file not found: ${schemaPath}`);
  }

  const content = fs.readFileSync(schemaPath, 'utf-8');
  const sourceFile = parseFile(schemaPath, content);

  const tables: DrizzleTable[] = [];
  const enums: DrizzleEnum[] = [];

  // First pass: collect enum definitions
  walkAst(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          const enumDef = parseEnumDefinition(decl.name.text, decl.initializer);
          if (enumDef) {
            enums.push(enumDef);
          }
        }
      }
    }
  });

  // Build enum name lookup
  const enumByName = new Map<string, DrizzleEnum>();
  for (const e of enums) {
    enumByName.set(e.name, e);
  }

  // Second pass: collect table definitions
  walkAst(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          const table = parseTableDefinition(
            decl.name.text,
            decl.initializer,
            enumByName
          );
          if (table) {
            tables.push(table);
          }
        }
      }
    }
  });

  return {
    tables,
    enums,
    schemaPath,
  };
}

/**
 * Parse a pgEnum() definition
 * e.g., export const statusEnum = pgEnum('status', ['active', 'pending', 'closed']);
 */
function parseEnumDefinition(
  varName: string,
  initializer: ts.Expression
): DrizzleEnum | undefined {
  if (!ts.isCallExpression(initializer)) {
    return undefined;
  }

  // Check if it's a pgEnum call
  const funcName = ts.isIdentifier(initializer.expression)
    ? initializer.expression.text
    : undefined;

  if (funcName !== 'pgEnum') {
    return undefined;
  }

  const args = initializer.arguments;
  if (args.length < 2) {
    return undefined;
  }

  // First arg: SQL name
  const nameArg = args[0];
  if (!ts.isStringLiteral(nameArg)) {
    return undefined;
  }
  const sqlName = nameArg.text;

  // Second arg: values array
  const valuesArg = args[1];
  if (!ts.isArrayLiteralExpression(valuesArg)) {
    return undefined;
  }

  const values: string[] = [];
  for (const element of valuesArg.elements) {
    if (ts.isStringLiteral(element)) {
      values.push(element.text);
    }
  }

  return {
    name: varName,
    sqlName,
    values,
  };
}

/**
 * Parse a pgTable() definition
 */
function parseTableDefinition(
  varName: string,
  initializer: ts.Expression,
  enumByName: Map<string, DrizzleEnum>
): DrizzleTable | undefined {
  if (!ts.isCallExpression(initializer)) {
    return undefined;
  }

  // Check if it's a pgTable call
  const funcName = ts.isIdentifier(initializer.expression)
    ? initializer.expression.text
    : undefined;

  if (funcName !== 'pgTable') {
    return undefined;
  }

  const args = initializer.arguments;
  if (args.length < 2) {
    return undefined;
  }

  // First arg: SQL table name
  const nameArg = args[0];
  if (!ts.isStringLiteral(nameArg)) {
    return undefined;
  }
  const sqlName = nameArg.text;

  // Second arg: columns object
  const columnsArg = args[1];
  if (!ts.isObjectLiteralExpression(columnsArg)) {
    return undefined;
  }

  const columns: DrizzleColumn[] = [];

  for (const prop of columnsArg.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const column = parseColumnDefinition(
        prop.name.text,
        prop.initializer,
        enumByName
      );
      if (column) {
        columns.push(column);
      }
    }
  }

  return {
    name: varName,
    sqlName,
    columns,
  };
}

/**
 * Parse a column definition with its modifiers
 */
function parseColumnDefinition(
  colName: string,
  initializer: ts.Expression,
  enumByName: Map<string, DrizzleEnum>
): DrizzleColumn | undefined {
  // Collect all modifiers by walking the method chain
  const modifiers = collectColumnModifiers(initializer);

  // Get the column type from the base call
  const baseCall = getBaseColumnCall(initializer);
  if (!baseCall) {
    return undefined;
  }

  const { type, sqlName, enumName } = parseBaseColumnType(baseCall, enumByName);

  const notNull = modifiers.has('notNull');
  const hasDefault = modifiers.has('default') || modifiers.has('defaultNow');
  // Serial columns are always auto-generated (auto-increment)
  // $defaultFn also indicates auto-generation
  const isAutoGenerated = type === 'serial' || modifiers.has('$defaultFn');

  // A column is required for inserts if:
  // - It has notNull constraint
  // - It doesn't have a default value
  // - It's not auto-generated
  const isRequired = notNull && !hasDefault && !isAutoGenerated;

  return {
    name: colName,
    sqlName: sqlName || colName,
    type,
    enumName,
    notNull,
    hasDefault,
    isAutoGenerated,
    isRequired,
  };
}

/**
 * Collect all method call modifiers in a chain like:
 * text('name').notNull().default('foo')
 */
function collectColumnModifiers(expr: ts.Expression): Set<string> {
  const modifiers = new Set<string>();

  let current = expr;
  while (ts.isCallExpression(current)) {
    const callExpr = current.expression;

    // Check if this is a property access (method call in chain)
    if (ts.isPropertyAccessExpression(callExpr)) {
      modifiers.add(callExpr.name.text);
      current = callExpr.expression;
    } else {
      // Base call (e.g., text('name'))
      break;
    }
  }

  return modifiers;
}

/**
 * Get the base column type call (e.g., text('name') from text('name').notNull())
 */
function getBaseColumnCall(expr: ts.Expression): ts.CallExpression | undefined {
  let current = expr;

  while (ts.isCallExpression(current)) {
    const callExpr = current.expression;

    if (ts.isPropertyAccessExpression(callExpr)) {
      // Continue walking up the chain
      current = callExpr.expression;
    } else if (ts.isIdentifier(callExpr)) {
      // Found the base call
      return current;
    } else if (ts.isCallExpression(callExpr)) {
      // Enum column: statusEnum('status')
      // The enum call is the base
      return current;
    } else {
      break;
    }
  }

  // Handle enum column case: enumVar('colname')
  if (ts.isCallExpression(expr)) {
    return expr;
  }

  return undefined;
}

/**
 * Parse the base column type (e.g., text, integer, serial)
 */
function parseBaseColumnType(
  call: ts.CallExpression,
  enumByName: Map<string, DrizzleEnum>
): { type: DrizzleColumnType; sqlName?: string; enumName?: string } {
  let typeName: string | undefined;
  let sqlName: string | undefined;
  let enumName: string | undefined;

  // Get the function/identifier name
  if (ts.isIdentifier(call.expression)) {
    typeName = call.expression.text;
  } else if (ts.isCallExpression(call.expression)) {
    // This is an enum column: statusEnum('status')
    // where call.expression is the enum variable call
    if (ts.isIdentifier(call.expression.expression)) {
      const possibleEnumName = call.expression.expression.text;
      if (enumByName.has(possibleEnumName)) {
        typeName = 'enum';
        enumName = possibleEnumName;
      }
    }
  }

  // Check if this is an enum call directly: statusEnum('status')
  if (
    ts.isIdentifier(call.expression) &&
    enumByName.has(call.expression.text)
  ) {
    typeName = 'enum';
    enumName = call.expression.text;
  }

  // Get the SQL column name from first argument if it's a string
  if (call.arguments.length > 0) {
    const firstArg = call.arguments[0];
    if (ts.isStringLiteral(firstArg)) {
      sqlName = firstArg.text;
    }
  }

  const type = mapDrizzleType(typeName);

  return { type, sqlName, enumName };
}

/**
 * Map Drizzle function names to column types
 */
function mapDrizzleType(typeName: string | undefined): DrizzleColumnType {
  if (!typeName) {
    return 'unknown';
  }

  const typeMap: Record<string, DrizzleColumnType> = {
    text: 'text',
    varchar: 'varchar',
    integer: 'integer',
    serial: 'serial',
    bigint: 'bigint',
    boolean: 'boolean',
    timestamp: 'timestamp',
    date: 'date',
    json: 'json',
    jsonb: 'jsonb',
    uuid: 'uuid',
    real: 'real',
    doublePrecision: 'doublePrecision',
    numeric: 'numeric',
    enum: 'enum',
  };

  return typeMap[typeName] || 'unknown';
}

/**
 * Get a table by name from the schema
 */
export function getTableByName(
  schema: DrizzleSchema,
  tableName: string
): DrizzleTable | undefined {
  return schema.tables.find((t) => t.name === tableName);
}

/**
 * Get an enum by name from the schema
 */
export function getEnumByName(
  schema: DrizzleSchema,
  enumName: string
): DrizzleEnum | undefined {
  return schema.enums.find((e) => e.name === enumName);
}

/**
 * Get required columns for a table (columns needed for insert)
 */
export function getRequiredColumns(table: DrizzleTable): DrizzleColumn[] {
  return table.columns.filter((c) => c.isRequired);
}

/**
 * Check if a column type expects a numeric value
 */
export function isNumericColumn(column: DrizzleColumn): boolean {
  return [
    'integer',
    'serial',
    'bigint',
    'real',
    'doublePrecision',
    'numeric',
  ].includes(column.type);
}

/**
 * Check if a column is an enum type
 */
export function isEnumColumn(column: DrizzleColumn): boolean {
  return column.type === 'enum' && !!column.enumName;
}
