import * as fs from "fs";
import ts from "typescript";
import type {
  ComponentAnalysis,
  LinkReference,
  FormReference,
  DataHookReference,
  SourceLocation,
} from "../types.js";
import {
  parseFile,
  walkAst,
  isJsxElementWithName,
  getJsxAttribute,
  getJsxAttributeStringValue,
  isCallTo,
  isExported,
  getLineAndColumn,
} from "../utils/ast-utils.js";

/**
 * Parse a TSX component file and extract links, forms, and hooks
 */
export function parseComponent(filePath: string): ComponentAnalysis {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = parseFile(filePath, content);

  const links: LinkReference[] = [];
  const forms: FormReference[] = [];
  const dataHooks: DataHookReference[] = [];
  let hasLoader = false;
  let hasAction = false;

  walkAst(sourceFile, (node) => {
    // Check for Link components
    if (isJsxElementWithName(node, "Link")) {
      const link = extractLinkReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for anchor tags with href
    if (isJsxElementWithName(node, "a")) {
      const link = extractAnchorReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for Form components
    if (isJsxElementWithName(node, "Form")) {
      const form = extractFormReference(node, sourceFile, filePath);
      if (form) {
        forms.push(form);
      }
    }

    // Check for redirect() calls
    if (isCallTo(node, "redirect")) {
      const link = extractRedirectReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for useNavigate().navigate() pattern
    // This is more complex - we'd need to track the variable
    // For now, look for navigate() calls directly
    if (isCallTo(node, "navigate")) {
      const link = extractNavigateReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for data hooks
    if (isCallTo(node, "useLoaderData")) {
      const hookRef = createDataHookReference(
        "useLoaderData",
        node,
        sourceFile,
        filePath
      );
      dataHooks.push(hookRef);
    }

    if (isCallTo(node, "useActionData")) {
      const hookRef = createDataHookReference(
        "useActionData",
        node,
        sourceFile,
        filePath
      );
      dataHooks.push(hookRef);
    }

    if (isCallTo(node, "useParams")) {
      const hookRef = extractUseParamsReference(node, sourceFile, filePath);
      dataHooks.push(hookRef);
    }

    // Check for loader/action exports
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (isExported(node)) {
        if (node.name.text === "loader") {
          hasLoader = true;
        }
        if (node.name.text === "action") {
          hasAction = true;
        }
      }
    }

    // Also check for exported variable declarations (arrow functions)
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          if (decl.name.text === "loader") {
            hasLoader = true;
          }
          if (decl.name.text === "action") {
            hasAction = true;
          }
        }
      }
    }
  });

  return {
    file: filePath,
    links,
    forms,
    dataHooks,
    hasLoader,
    hasAction,
  };
}

/**
 * Extract a Link reference from a <Link> element
 */
function extractLinkReference(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string
): LinkReference | undefined {
  // Check for "to" or "href" attribute
  const toAttr = getJsxAttribute(element, "to");
  const hrefAttr = getJsxAttribute(element, "href");
  const attr = toAttr || hrefAttr;

  if (!attr) {
    return undefined;
  }

  const value = getJsxAttributeStringValue(attr);
  if (!value) {
    // Complex expression we can't analyze
    return undefined;
  }

  // Skip external URLs and hash links
  if (isExternalOrHash(value.value)) {
    return undefined;
  }

  const pos = getLineAndColumn(sourceFile, element.getStart());

  return {
    href: value.value,
    isDynamic: value.isDynamic,
    pattern: value.isDynamic ? normalizeToPattern(value.value) : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    type: "link",
  };
}

/**
 * Extract a Link reference from an <a> element
 */
function extractAnchorReference(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string
): LinkReference | undefined {
  const hrefAttr = getJsxAttribute(element, "href");
  if (!hrefAttr) {
    return undefined;
  }

  const value = getJsxAttributeStringValue(hrefAttr);
  if (!value) {
    return undefined;
  }

  // Skip external URLs and hash links
  if (isExternalOrHash(value.value)) {
    return undefined;
  }

  const pos = getLineAndColumn(sourceFile, element.getStart());

  return {
    href: value.value,
    isDynamic: value.isDynamic,
    pattern: value.isDynamic ? normalizeToPattern(value.value) : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    type: "link",
  };
}

/**
 * Extract a Form reference from a <Form> element
 */
function extractFormReference(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string
): FormReference {
  const actionAttr = getJsxAttribute(element, "action");
  const methodAttr = getJsxAttribute(element, "method");

  let action: string | undefined;
  if (actionAttr) {
    const value = getJsxAttributeStringValue(actionAttr);
    action = value?.value;
  }

  let method: FormReference["method"] = "post";
  if (methodAttr) {
    const value = getJsxAttributeStringValue(methodAttr);
    if (value) {
      const m = value.value.toLowerCase();
      if (["get", "post", "put", "patch", "delete"].includes(m)) {
        method = m as FormReference["method"];
      }
    }
  }

  // Extract input names from form children
  const inputNames = extractFormInputNames(element, sourceFile);

  const pos = getLineAndColumn(sourceFile, element.getStart());

  return {
    action,
    method,
    inputNames,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
  };
}

/**
 * Extract input names from form children
 */
function extractFormInputNames(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile
): string[] {
  const names: string[] = [];

  walkAst(element, (node) => {
    if (isJsxElementWithName(node, "input") || isJsxElementWithName(node, "select") || isJsxElementWithName(node, "textarea")) {
      const nameAttr = getJsxAttribute(node, "name");
      if (nameAttr) {
        const value = getJsxAttributeStringValue(nameAttr);
        if (value) {
          names.push(value.value);
        }
      }
    }
  });

  return names;
}

/**
 * Extract a redirect reference from a redirect() call
 */
function extractRedirectReference(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string
): LinkReference | undefined {
  if (call.arguments.length === 0) {
    return undefined;
  }

  const arg = call.arguments[0];

  let value: { value: string; isDynamic: boolean } | undefined;

  if (ts.isStringLiteral(arg)) {
    value = { value: arg.text, isDynamic: false };
  } else if (ts.isTemplateExpression(arg)) {
    let pattern = arg.head.text;
    for (const span of arg.templateSpans) {
      pattern += ":param" + span.literal.text;
    }
    value = { value: pattern, isDynamic: true };
  } else if (ts.isNoSubstitutionTemplateLiteral(arg)) {
    value = { value: arg.text, isDynamic: false };
  }

  if (!value || isExternalOrHash(value.value)) {
    return undefined;
  }

  const pos = getLineAndColumn(sourceFile, call.getStart());

  return {
    href: value.value,
    isDynamic: value.isDynamic,
    pattern: value.isDynamic ? normalizeToPattern(value.value) : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    type: "redirect",
  };
}

/**
 * Extract a navigate reference from a navigate() call
 */
function extractNavigateReference(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string
): LinkReference | undefined {
  if (call.arguments.length === 0) {
    return undefined;
  }

  const arg = call.arguments[0];

  let value: { value: string; isDynamic: boolean } | undefined;

  if (ts.isStringLiteral(arg)) {
    value = { value: arg.text, isDynamic: false };
  } else if (ts.isTemplateExpression(arg)) {
    let pattern = arg.head.text;
    for (const span of arg.templateSpans) {
      pattern += ":param" + span.literal.text;
    }
    value = { value: pattern, isDynamic: true };
  } else if (ts.isNoSubstitutionTemplateLiteral(arg)) {
    value = { value: arg.text, isDynamic: false };
  }

  if (!value || isExternalOrHash(value.value)) {
    return undefined;
  }

  const pos = getLineAndColumn(sourceFile, call.getStart());

  return {
    href: value.value,
    isDynamic: value.isDynamic,
    pattern: value.isDynamic ? normalizeToPattern(value.value) : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    type: "navigate",
  };
}

/**
 * Create a data hook reference
 */
function createDataHookReference(
  hook: "useLoaderData" | "useActionData",
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string
): DataHookReference {
  const pos = getLineAndColumn(sourceFile, call.getStart());

  return {
    hook,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
  };
}

/**
 * Extract useParams reference with accessed param names
 */
function extractUseParamsReference(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string
): DataHookReference {
  const pos = getLineAndColumn(sourceFile, call.getStart());

  // Try to find which params are accessed
  // This is complex as it depends on how the result is used
  // For now, we'll do basic tracking

  const accessedParams: string[] = [];

  // Look at the parent - if it's a variable declaration, track property access
  const parent = call.parent;
  if (ts.isVariableDeclaration(parent)) {
    // Destructuring: const { id } = useParams()
    if (ts.isObjectBindingPattern(parent.name)) {
      for (const element of parent.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          accessedParams.push(element.name.text);
        }
      }
    }
  }

  return {
    hook: "useParams",
    accessedParams: accessedParams.length > 0 ? accessedParams : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
  };
}

/**
 * Check if a URL is external or a hash link
 */
function isExternalOrHash(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("#") ||
    url.startsWith("//")
  );
}

/**
 * Normalize a dynamic href to a pattern for matching
 * "/employees/:param" stays the same
 */
function normalizeToPattern(href: string): string {
  return href;
}
