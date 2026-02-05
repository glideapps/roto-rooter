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
  /** Maps intent values to fields used in that intent branch */
  intentFieldGroups?: Map<string, string[]>;
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
  let intentFieldGroups: Map<string, string[]> | undefined;
  if (actionNode) {
    const result = extractFormDataFieldsWithIntents(actionNode);
    actionFields = result.allFields;
    intentFieldGroups =
      result.intentGroups.size > 0 ? result.intentGroups : undefined;
  }

  return {
    hasLoader,
    hasAction,
    loaderLocation,
    actionLocation,
    actionFields,
    intentFieldGroups,
  };
}

interface FieldExtractionResult {
  allFields: string[];
  intentGroups: Map<string, string[]>;
}

/**
 * Extract field names accessed via formData.get(), formData.getAll(), formData.has()
 * Also tracks intent-based field groups for pattern like:
 *   if (intent === "create") { formData.get("title") }
 *   if (intent === "delete") { formData.get("id") }
 */
function extractFormDataFieldsWithIntents(
  actionNode: ts.Node
): FieldExtractionResult {
  const allFields: Set<string> = new Set();
  const intentGroups = new Map<string, Set<string>>();
  const formDataVariables: Set<string> = new Set();
  const intentVariables: Set<string> = new Set();
  const knownIntents: Set<string> = new Set();

  // First pass: find variables that hold formData and intent
  walkAst(actionNode, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (initializer && isFormDataCall(initializer)) {
        formDataVariables.add(node.name.text);
      }
      // Detect intent variable: const intent = formData.get("intent")
      if (initializer && isIntentGet(initializer, formDataVariables)) {
        intentVariables.add(node.name.text);
      }
    }
  });

  // Second pass: collect all intent check values (even without formData access inside)
  walkAst(actionNode, (node) => {
    if (ts.isIfStatement(node)) {
      const intentValue = extractIntentCheckValue(
        node.expression,
        intentVariables
      );
      if (intentValue) {
        knownIntents.add(intentValue);
      }
    }
  });

  // Third pass: find .get(), .getAll(), .has() calls and track intent context
  walkAst(actionNode, (node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text;
        if (['get', 'getAll', 'has'].includes(methodName)) {
          if (
            ts.isIdentifier(expr.expression) &&
            formDataVariables.has(expr.expression.text)
          ) {
            const fieldName = extractStringArgument(node);
            if (fieldName) {
              allFields.add(fieldName);

              // Check if this is inside an intent check
              const intentValue = findEnclosingIntentCheck(
                node,
                intentVariables
              );
              if (intentValue) {
                if (!intentGroups.has(intentValue)) {
                  intentGroups.set(intentValue, new Set());
                }
                intentGroups.get(intentValue)!.add(fieldName);
              }
            }
          }
        }
      }
    }
  });

  // Convert sets to arrays - include ALL known intents
  const result: FieldExtractionResult = {
    allFields: Array.from(allFields),
    intentGroups: new Map(),
  };

  // Include all known intents, even if they have no fields inside
  for (const intent of knownIntents) {
    const fields = intentGroups.get(intent);
    result.intentGroups.set(intent, fields ? Array.from(fields) : []);
  }

  return result;
}

/**
 * Check if an expression is formData.get("intent")
 */
function isIntentGet(
  expr: ts.Expression,
  formDataVariables: Set<string>
): boolean {
  if (ts.isCallExpression(expr)) {
    const callExpr = expr.expression;
    if (ts.isPropertyAccessExpression(callExpr)) {
      if (
        callExpr.name.text === 'get' &&
        ts.isIdentifier(callExpr.expression) &&
        formDataVariables.has(callExpr.expression.text)
      ) {
        const arg = extractStringArgument(expr);
        return arg === 'intent';
      }
    }
  }
  return false;
}

/**
 * Find if a node is inside an if statement checking intent === "value"
 * Returns the intent value if found, undefined otherwise
 */
function findEnclosingIntentCheck(
  node: ts.Node,
  intentVariables: Set<string>
): string | undefined {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isIfStatement(current)) {
      const intentValue = extractIntentCheckValue(
        current.expression,
        intentVariables
      );
      if (intentValue) {
        return intentValue;
      }
    }
    current = current.parent;
  }

  return undefined;
}

/**
 * Extract the intent value from a condition like intent === "create"
 */
function extractIntentCheckValue(
  condition: ts.Expression,
  intentVariables: Set<string>
): string | undefined {
  // Handle: intent === "create"
  if (ts.isBinaryExpression(condition)) {
    if (
      condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
    ) {
      const { left, right } = condition;

      // intent === "value"
      if (ts.isIdentifier(left) && intentVariables.has(left.text)) {
        if (ts.isStringLiteral(right)) {
          return right.text;
        }
      }

      // "value" === intent
      if (ts.isIdentifier(right) && intentVariables.has(right.text)) {
        if (ts.isStringLiteral(left)) {
          return left.text;
        }
      }
    }
  }

  return undefined;
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
