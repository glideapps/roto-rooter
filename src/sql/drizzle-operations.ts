/**
 * Drizzle ORM Database Operation Extraction
 *
 * This module extracts database write operations (INSERT, UPDATE, DELETE)
 * from Drizzle ORM code, including tracking data sources for validation.
 *
 * Used by the persistence check to validate operations against the schema.
 */

import * as fs from 'fs';
import ts from 'typescript';
import {
  parseFile,
  walkAst,
  getLineAndColumn,
  getNodeSpan,
} from '../utils/ast-utils.js';
import type { DbOperation, DbColumnValue, DataSource } from '../types.js';

/**
 * Result of extracting database operations from an action
 */
export interface DbOperationExtractionResult {
  operations: DbOperation[];
}

/**
 * Extract database operations from a route file
 * Looks for db.insert(), db.update(), db.delete() patterns
 */
export function extractDbOperations(
  filePath: string
): DbOperationExtractionResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseFile(filePath, content);

  const operations: DbOperation[] = [];

  // Track variable sources (e.g., which variables come from formData.get())
  const variableSources = new Map<string, DataSource>();
  const formDataVariables = new Set<string>();
  // Track validated variables (via zod parse, safeParse, etc.)
  const validatedVariables = new Set<string>();

  // First pass: collect formData variables and track data sources
  walkAst(sourceFile, (node) => {
    // Track formData variable assignments
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const varName = node.name.text;
      const initializer = node.initializer;

      if (initializer && isFormDataCall(initializer)) {
        formDataVariables.add(varName);
      }

      // Track formData.get() assignments
      if (initializer) {
        const source = analyzeDataSource(
          initializer,
          formDataVariables,
          validatedVariables
        );
        if (source) {
          variableSources.set(varName, source);
        }

        // Track validation: const data = schema.parse(formData) or safeParse
        if (isValidationCall(initializer)) {
          validatedVariables.add(varName);
        }
      }
    }

    // Track destructured validation results
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      if (node.initializer && isValidationCall(node.initializer)) {
        for (const element of node.name.elements) {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            validatedVariables.add(element.name.text);
          }
        }
      }
    }
  });

  // Second pass: find db operations
  walkAst(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const operation = parseDbOperation(
        node,
        sourceFile,
        filePath,
        variableSources,
        formDataVariables,
        validatedVariables
      );
      if (operation) {
        operations.push(operation);
      }
    }
  });

  // Deduplicate operations by position (same line/column = same operation)
  // This handles cases where nested call expressions both match
  const uniqueOperations = operations.filter(
    (op, index, arr) =>
      arr.findIndex(
        (o) =>
          o.location.line === op.location.line &&
          o.location.column === op.location.column
      ) === index
  );

  return { operations: uniqueOperations };
}

// ============================================================================
// Form Data Detection
// ============================================================================

/**
 * Check if an expression is a call to request.formData() or similar
 */
function isFormDataCall(expr: ts.Expression): boolean {
  // Handle await: await request.formData()
  if (ts.isAwaitExpression(expr)) {
    return isFormDataCall(expr.expression);
  }

  // Handle call expression: request.formData()
  if (ts.isCallExpression(expr)) {
    const callExpr = expr.expression;
    if (ts.isPropertyAccessExpression(callExpr)) {
      return callExpr.name.text === 'formData';
    }
  }

  return false;
}

/**
 * Check if an expression is a validation call (zod, etc.)
 */
function isValidationCall(expr: ts.Expression): boolean {
  // Handle await expressions
  if (ts.isAwaitExpression(expr)) {
    return isValidationCall(expr.expression);
  }

  if (!ts.isCallExpression(expr)) {
    return false;
  }

  const callExpr = expr.expression;

  // schema.parse(...), schema.safeParse(...), schema.parseAsync(...)
  if (ts.isPropertyAccessExpression(callExpr)) {
    const methodName = callExpr.name.text;
    return ['parse', 'safeParse', 'parseAsync', 'safeParseAsync'].includes(
      methodName
    );
  }

  return false;
}

// ============================================================================
// Data Source Analysis
// ============================================================================

/**
 * Analyze the data source of an expression
 */
function analyzeDataSource(
  expr: ts.Expression,
  formDataVariables: Set<string>,
  validatedVariables: Set<string>
): DataSource | undefined {
  // Handle formData.get('fieldName')
  if (ts.isCallExpression(expr)) {
    const callExpr = expr.expression;
    if (ts.isPropertyAccessExpression(callExpr)) {
      const methodName = callExpr.name.text;

      // formData.get(), formData.getAll()
      if (
        (methodName === 'get' || methodName === 'getAll') &&
        ts.isIdentifier(callExpr.expression) &&
        formDataVariables.has(callExpr.expression.text)
      ) {
        const fieldName = extractStringArgument(expr);
        return {
          source: 'formData',
          type: 'string',
          fieldName,
          isValidated: false,
        };
      }

      // params.id (from route params)
      if (ts.isIdentifier(callExpr.expression)) {
        const objName = callExpr.expression.text;
        if (objName === 'params') {
          return {
            source: 'params',
            type: 'string',
            fieldName: methodName,
            isValidated: false,
          };
        }
      }
    }
  }

  // Handle property access: params.id
  if (ts.isPropertyAccessExpression(expr)) {
    if (ts.isIdentifier(expr.expression)) {
      const objName = expr.expression.text;
      if (objName === 'params') {
        return {
          source: 'params',
          type: 'string',
          fieldName: expr.name.text,
          isValidated: false,
        };
      }
    }
  }

  // Handle literals
  if (ts.isStringLiteral(expr)) {
    return { source: 'literal', type: 'string', literalValue: expr.text };
  }
  if (ts.isNumericLiteral(expr)) {
    return {
      source: 'literal',
      type: 'number',
      literalValue: Number(expr.text),
    };
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return { source: 'literal', type: 'boolean', literalValue: true };
  }
  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return { source: 'literal', type: 'boolean', literalValue: false };
  }
  if (expr.kind === ts.SyntaxKind.NullKeyword) {
    return { source: 'literal', type: 'null' };
  }

  // Handle type conversions: Number(formData.get('age')), parseInt(...)
  if (ts.isCallExpression(expr)) {
    const funcName = ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : undefined;

    if (
      funcName === 'Number' ||
      funcName === 'parseInt' ||
      funcName === 'parseFloat'
    ) {
      // The inner expression is being converted to number
      const innerSource = expr.arguments[0]
        ? analyzeDataSource(
            expr.arguments[0],
            formDataVariables,
            validatedVariables
          )
        : undefined;

      if (innerSource) {
        return {
          ...innerSource,
          type: 'number',
        };
      }
    }

    if (funcName === 'Boolean') {
      const innerSource = expr.arguments[0]
        ? analyzeDataSource(
            expr.arguments[0],
            formDataVariables,
            validatedVariables
          )
        : undefined;

      if (innerSource) {
        return {
          ...innerSource,
          type: 'boolean',
        };
      }
    }
  }

  return undefined;
}

/**
 * Extract string literal from first argument of a call expression
 */
function extractStringArgument(call: ts.CallExpression): string | undefined {
  if (call.arguments.length === 0) {
    return undefined;
  }

  const arg = call.arguments[0];
  if (ts.isStringLiteral(arg)) {
    return arg.text;
  }
  if (ts.isNoSubstitutionTemplateLiteral(arg)) {
    return arg.text;
  }

  return undefined;
}

/**
 * Infer data source from a variable reference
 */
function inferDataSourceFromExpression(
  expr: ts.Expression,
  variableSources: Map<string, DataSource>,
  validatedVariables: Set<string>
): DataSource | undefined {
  // Variable reference: someVar
  if (ts.isIdentifier(expr)) {
    const varName = expr.text;

    // Check if this is a validated variable
    if (validatedVariables.has(varName)) {
      return { source: 'variable', type: 'unknown', isValidated: true };
    }

    // Check if we have tracked this variable's source
    const source = variableSources.get(varName);
    if (source) {
      return source;
    }

    return { source: 'variable', type: 'unknown' };
  }

  // Property access on validated data: data.fieldName
  if (ts.isPropertyAccessExpression(expr)) {
    if (ts.isIdentifier(expr.expression)) {
      const objName = expr.expression.text;
      if (validatedVariables.has(objName)) {
        return { source: 'variable', type: 'unknown', isValidated: true };
      }
    }
  }

  return undefined;
}

// ============================================================================
// DB Operation Parsing
// ============================================================================

/**
 * Parse a db.insert/update/delete call expression
 */
function parseDbOperation(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  variableSources: Map<string, DataSource>,
  formDataVariables: Set<string>,
  validatedVariables: Set<string>
): DbOperation | undefined {
  // Look for patterns like:
  // db.insert(users).values({...})
  // db.update(users).set({...}).where(...)
  // db.delete(users).where(...)

  // Walk up the call chain to find the base db.insert/update/delete
  const chainInfo = parseDbCallChain(call);
  if (!chainInfo) {
    return undefined;
  }

  const { type, tableName, valuesCall, hasWhere } = chainInfo;
  const loc = getLineAndColumn(sourceFile, call.getStart(sourceFile));

  const operation: DbOperation = {
    type,
    tableName,
    columnValues: [],
    hasWhere,
    location: {
      file: filePath,
      line: loc.line,
      column: loc.column,
    },
    span: getNodeSpan(sourceFile, call, filePath),
  };

  // Extract column values from .values() or .set()
  if (valuesCall) {
    const columnValues = extractColumnValues(
      valuesCall,
      sourceFile,
      filePath,
      variableSources,
      formDataVariables,
      validatedVariables
    );
    operation.columnValues = columnValues;
  }

  return operation;
}

interface DbCallChainInfo {
  type: 'insert' | 'update' | 'delete';
  tableName: string;
  valuesCall?: ts.CallExpression;
  hasWhere: boolean;
}

/**
 * Parse a chain of db method calls to extract operation info
 * e.g., db.insert(users).values({...})
 */
function parseDbCallChain(
  call: ts.CallExpression
): DbCallChainInfo | undefined {
  // Traverse the call chain to find db.insert/update/delete
  let current: ts.Expression = call;
  let valuesCall: ts.CallExpression | undefined;
  let operationType: 'insert' | 'update' | 'delete' | undefined;
  let tableName: string | undefined;
  let hasWhere = false;

  // Walk up the expression tree
  while (current) {
    if (ts.isCallExpression(current)) {
      const expr = current.expression;

      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text;

        // Check for .values() or .set()
        if (methodName === 'values' || methodName === 'set') {
          valuesCall = current;
        }

        // Check for .where()
        if (methodName === 'where') {
          hasWhere = true;
        }

        // Check for db.insert(), db.update(), db.delete()
        if (
          ts.isCallExpression(expr.expression) &&
          ts.isPropertyAccessExpression(expr.expression.expression)
        ) {
          const innerExpr = expr.expression.expression;
          const innerMethod = innerExpr.name.text;

          if (
            innerMethod === 'insert' ||
            innerMethod === 'update' ||
            innerMethod === 'delete'
          ) {
            operationType = innerMethod;

            // Get table name from argument
            const tableArg = expr.expression.arguments[0];
            if (tableArg && ts.isIdentifier(tableArg)) {
              tableName = tableArg.text;
            }
            break;
          }
        }

        // Direct db.insert(), db.update(), db.delete() without chaining
        if (
          methodName === 'insert' ||
          methodName === 'update' ||
          methodName === 'delete'
        ) {
          operationType = methodName;

          // Get table name from argument
          const tableArg = current.arguments[0];
          if (tableArg && ts.isIdentifier(tableArg)) {
            tableName = tableArg.text;
          }

          // Check if this is already the values call
          if (!valuesCall && methodName === 'insert') {
            // Look for .values() in parent
            const parent = current.parent;
            if (
              parent &&
              ts.isPropertyAccessExpression(parent) &&
              parent.name.text === 'values' &&
              parent.parent &&
              ts.isCallExpression(parent.parent)
            ) {
              valuesCall = parent.parent;
            }
          }
          break;
        }

        // Continue up the chain
        current = expr.expression;
      } else {
        break;
      }
    } else if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
    } else {
      break;
    }
  }

  // Also check if the original call is the values call
  if (ts.isCallExpression(call)) {
    const expr = call.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const methodName = expr.name.text;
      if (methodName === 'where') {
        hasWhere = true;
      }
      if (methodName === 'values' || methodName === 'set') {
        valuesCall = call;

        // Look for db.insert in the chain
        let inner: ts.Expression = expr.expression;
        while (inner) {
          if (ts.isCallExpression(inner)) {
            const innerExpr: ts.LeftHandSideExpression = inner.expression;
            if (ts.isPropertyAccessExpression(innerExpr)) {
              const innerMethod = innerExpr.name.text;
              if (
                innerMethod === 'insert' ||
                innerMethod === 'update' ||
                innerMethod === 'delete'
              ) {
                operationType = innerMethod;
                const tableArg = inner.arguments[0];
                if (tableArg && ts.isIdentifier(tableArg)) {
                  tableName = tableArg.text;
                }
                break;
              }
              inner = innerExpr.expression;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }
    }
  }

  if (!operationType || !tableName) {
    return undefined;
  }

  return { type: operationType, tableName, valuesCall, hasWhere };
}

/**
 * Extract column values from a .values({...}) or .set({...}) call
 */
function extractColumnValues(
  valuesCall: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  variableSources: Map<string, DataSource>,
  formDataVariables: Set<string>,
  validatedVariables: Set<string>
): DbColumnValue[] {
  const columnValues: DbColumnValue[] = [];

  if (valuesCall.arguments.length === 0) {
    return columnValues;
  }

  const arg = valuesCall.arguments[0];

  // Handle object literal: .values({ name, email: foo, age: 42 })
  if (ts.isObjectLiteralExpression(arg)) {
    for (const prop of arg.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const columnName = ts.isIdentifier(prop.name)
          ? prop.name.text
          : ts.isStringLiteral(prop.name)
            ? prop.name.text
            : undefined;

        if (columnName) {
          const dataSource =
            analyzeDataSource(
              prop.initializer,
              formDataVariables,
              validatedVariables
            ) ||
            inferDataSourceFromExpression(
              prop.initializer,
              variableSources,
              validatedVariables
            );

          columnValues.push({
            columnName,
            dataSource: dataSource || { source: 'unknown', type: 'unknown' },
            span: getNodeSpan(sourceFile, prop.initializer, filePath),
          });
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        // Shorthand: { name } is equivalent to { name: name }
        const columnName = prop.name.text;
        const varSource = variableSources.get(columnName);

        columnValues.push({
          columnName,
          dataSource: varSource || { source: 'variable', type: 'unknown' },
          span: getNodeSpan(sourceFile, prop.name, filePath),
        });
      }
    }
  }

  return columnValues;
}
