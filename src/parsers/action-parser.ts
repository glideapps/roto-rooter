import * as fs from "fs";
import ts from "typescript";
import { parseFile, walkAst, isExported } from "../utils/ast-utils.js";

export interface RouteExports {
  hasLoader: boolean;
  hasAction: boolean;
  loaderLocation?: { line: number; column: number };
  actionLocation?: { line: number; column: number };
}

/**
 * Parse a route file to check for loader/action exports
 */
export function parseRouteExports(filePath: string): RouteExports {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = parseFile(filePath, content);

  let hasLoader = false;
  let hasAction = false;
  let loaderLocation: { line: number; column: number } | undefined;
  let actionLocation: { line: number; column: number } | undefined;

  walkAst(sourceFile, (node) => {
    // Check for exported function declarations
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      const name = node.name.text;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );

      if (name === "loader") {
        hasLoader = true;
        loaderLocation = { line: line + 1, column: character + 1 };
      }
      if (name === "action") {
        hasAction = true;
        actionLocation = { line: line + 1, column: character + 1 };
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

          if (name === "loader") {
            hasLoader = true;
            loaderLocation = { line: line + 1, column: character + 1 };
          }
          if (name === "action") {
            hasAction = true;
            actionLocation = { line: line + 1, column: character + 1 };
          }
        }
      }
    }
  });

  return {
    hasLoader,
    hasAction,
    loaderLocation,
    actionLocation,
  };
}
