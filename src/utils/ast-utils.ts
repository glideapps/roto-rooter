import ts from 'typescript';
import type { SourceSpan } from '../types.js';

/**
 * Parse a TypeScript/TSX file and return its source file AST
 */
export function parseFile(filePath: string, content: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

/**
 * Get line and column from a position in a source file
 */
export function getLineAndColumn(
  sourceFile: ts.SourceFile,
  position: number
): { line: number; column: number } {
  const { line, character } =
    sourceFile.getLineAndCharacterOfPosition(position);
  return { line: line + 1, column: character + 1 };
}

/**
 * Check if a node is a JSX element with a specific tag name
 */
export function isJsxElementWithName(
  node: ts.Node,
  name: string
): node is ts.JsxElement | ts.JsxSelfClosingElement {
  if (ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName;
    return ts.isIdentifier(tagName) && tagName.text === name;
  }
  if (ts.isJsxSelfClosingElement(node)) {
    const tagName = node.tagName;
    return ts.isIdentifier(tagName) && tagName.text === name;
  }
  return false;
}

/**
 * Get JSX attribute value by name
 */
export function getJsxAttribute(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  attributeName: string
): ts.JsxAttribute | undefined {
  const attributes = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : element.attributes;

  for (const attr of attributes.properties) {
    if (
      ts.isJsxAttribute(attr) &&
      ts.isIdentifier(attr.name) &&
      attr.name.text === attributeName
    ) {
      return attr;
    }
  }
  return undefined;
}

/**
 * Extract string value from a JSX attribute
 * Returns undefined for complex expressions that can't be statically analyzed
 */
export function getJsxAttributeStringValue(
  attr: ts.JsxAttribute
): { value: string; isDynamic: boolean } | undefined {
  const initializer = attr.initializer;
  if (!initializer) {
    return undefined;
  }

  // String literal: href="/path"
  if (ts.isStringLiteral(initializer)) {
    return { value: initializer.text, isDynamic: false };
  }

  // JSX expression: href={...}
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expr = initializer.expression;

    // String literal inside expression: href={"/path"}
    if (ts.isStringLiteral(expr)) {
      return { value: expr.text, isDynamic: false };
    }

    // Template literal: href={`/employees/${id}`}
    if (ts.isTemplateExpression(expr)) {
      return extractTemplatePattern(expr);
    }

    // No-substitution template: href={`/employees`}
    if (ts.isNoSubstitutionTemplateLiteral(expr)) {
      return { value: expr.text, isDynamic: false };
    }
  }

  return undefined;
}

/**
 * Extract string value and span from a JSX attribute for auto-fix support
 * Returns the span of the value node (string literal or template)
 */
export function getJsxAttributeStringValueWithSpan(
  attr: ts.JsxAttribute
): { value: string; isDynamic: boolean; valueNode: ts.Node } | undefined {
  const initializer = attr.initializer;
  if (!initializer) {
    return undefined;
  }

  // String literal: href="/path"
  if (ts.isStringLiteral(initializer)) {
    return {
      value: initializer.text,
      isDynamic: false,
      valueNode: initializer,
    };
  }

  // JSX expression: href={...}
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expr = initializer.expression;

    // String literal inside expression: href={"/path"}
    if (ts.isStringLiteral(expr)) {
      return { value: expr.text, isDynamic: false, valueNode: expr };
    }

    // Template literal: href={`/employees/${id}`}
    if (ts.isTemplateExpression(expr)) {
      const pattern = extractTemplatePattern(expr);
      return { ...pattern, valueNode: expr };
    }

    // No-substitution template: href={`/employees`}
    if (ts.isNoSubstitutionTemplateLiteral(expr)) {
      return { value: expr.text, isDynamic: false, valueNode: expr };
    }
  }

  return undefined;
}

/**
 * Extract a pattern from a template literal expression
 * e.g., `/employees/${id}` -> { value: "/employees/${id}", isDynamic: true }
 */
function extractTemplatePattern(template: ts.TemplateExpression): {
  value: string;
  isDynamic: boolean;
} {
  let pattern = template.head.text;

  for (const span of template.templateSpans) {
    // Replace interpolations with :param placeholder
    pattern += ':param' + span.literal.text;
  }

  return { value: pattern, isDynamic: true };
}

/**
 * Check if a node is a call expression to a specific function
 */
export function isCallTo(
  node: ts.Node,
  functionName: string
): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  const expr = node.expression;

  // Direct call: redirect("/path")
  if (ts.isIdentifier(expr)) {
    return expr.text === functionName;
  }

  return false;
}

/**
 * Check if a function/variable is exported
 */
export function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
}

/**
 * Walk the AST and call visitor for each node
 */
export function walkAst(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  ts.forEachChild(node, (child) => walkAst(child, visitor));
}

/**
 * Get source span for a node, including start/end positions for text replacement
 */
export function getNodeSpan(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  filePath: string
): SourceSpan {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    file: filePath,
    start,
    end,
    line: line + 1,
    column: character + 1,
  };
}

/**
 * Get the tag name of a JSX element if it's an identifier
 */
export function getJsxTagName(
  node: ts.JsxElement | ts.JsxSelfClosingElement
): string | undefined {
  const tagName = ts.isJsxElement(node)
    ? node.openingElement.tagName
    : node.tagName;

  if (ts.isIdentifier(tagName)) {
    return tagName.text;
  }
  return undefined;
}

/**
 * Check if a string starts with an uppercase letter (PascalCase component)
 */
export function isPascalCase(str: string): boolean {
  return (
    str.length > 0 && str[0] === str[0].toUpperCase() && /^[A-Z]/.test(str)
  );
}
