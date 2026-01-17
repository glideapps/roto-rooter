import * as fs from 'fs';
import ts from 'typescript';
import { parseFile, walkAst, isExported } from '../utils/ast-utils.js';

export interface RouteExports {
  hasLoader: boolean;
  hasAction: boolean;
  loaderLocation?: { line: number; column: number };
  actionLocation?: { line: number; column: number };
  /** Field names accessed via formData.get(), formData.getAll(), etc. */
  actionFields?: string[];
}

/**
 * Parse a route file to check for loader/action exports
 */
export function parseRouteExports(filePath: string): RouteExports {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseFile(filePath, content);

  let hasLoader = false;
  let hasAction = false;
  let loaderLocation: { line: number; column: number } | undefined;
  let actionLocation: { line: number; column: number } | undefined;
  let actionNode: ts.Node | undefined;

  walkAst(sourceFile, (node) => {
    // Check for exported function declarations
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      const name = node.name.text;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );

      if (name === 'loader') {
        hasLoader = true;
        loaderLocation = { line: line + 1, column: character + 1 };
      }
      if (name === 'action') {
        hasAction = true;
        actionLocation = { line: line + 1, column: character + 1 };
        actionNode = node;
      }
    }

    // Check for exported variable declarations (arrow functions)
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            decl.getStart()
          );

          if (name === 'loader') {
            hasLoader = true;
            loaderLocation = { line: line + 1, column: character + 1 };
          }
          if (name === 'action') {
            hasAction = true;
            actionLocation = { line: line + 1, column: character + 1 };
            actionNode = decl.initializer;
          }
        }
      }
    }
  });

  // Extract field names from the action function
  let actionFields: string[] | undefined;
  if (actionNode) {
    actionFields = extractFormDataFields(actionNode);
  }

  return {
    hasLoader,
    hasAction,
    loaderLocation,
    actionLocation,
    actionFields,
  };
}

/**
 * Extract field names accessed via formData.get(), formData.getAll(), formData.has()
 * Handles patterns like:
 *   - formData.get('fieldName')
 *   - formData.getAll('fieldName')
 *   - data.get('fieldName') where data = await request.formData()
 */
function extractFormDataFields(actionNode: ts.Node): string[] {
  const fields: Set<string> = new Set();
  const formDataVariables: Set<string> = new Set();

  // First pass: find variables that hold formData
  // e.g., const formData = await request.formData()
  walkAst(actionNode, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (initializer && isFormDataCall(initializer)) {
        formDataVariables.add(node.name.text);
      }
    }
  });

  // Second pass: find .get(), .getAll(), .has() calls on formData variables
  walkAst(actionNode, (node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text;
        if (['get', 'getAll', 'has'].includes(methodName)) {
          // Check if calling on a known formData variable
          if (
            ts.isIdentifier(expr.expression) &&
            formDataVariables.has(expr.expression.text)
          ) {
            const fieldName = extractStringArgument(node);
            if (fieldName) {
              fields.add(fieldName);
            }
          }
        }
      }
    }
  });

  return Array.from(fields);
}

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
