import * as fs from 'fs';
import ts from 'typescript';
import type {
  ComponentAnalysis,
  LinkReference,
  FormReference,
  DataHookReference,
  HydrationRisk,
  SourceSpan,
} from '../types.js';
import {
  parseFile,
  walkAst,
  isJsxElementWithName,
  getJsxAttribute,
  getJsxAttributeStringValue,
  getJsxAttributeStringValueWithSpan,
  isCallTo,
  isExported,
  getLineAndColumn,
  getNodeSpan,
} from '../utils/ast-utils.js';

/**
 * Parse a TSX component file and extract links, forms, and hooks
 */
export function parseComponent(filePath: string): ComponentAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseFile(filePath, content);

  const links: LinkReference[] = [];
  const forms: FormReference[] = [];
  const dataHooks: DataHookReference[] = [];
  const hydrationRisks: HydrationRisk[] = [];
  let hasLoader = false;
  let hasAction = false;

  // Track context for hydration analysis
  const useEffectStack: ts.Node[] = [];
  const suppressWarningElements = new Set<ts.Node>();
  // Track server-side function bodies (loader, action) - code here doesn't cause hydration issues
  const serverFunctionBodies = new Set<ts.Node>();

  // First pass: find all elements with suppressHydrationWarning and server function bodies
  walkAst(sourceFile, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (hasSuppressHydrationWarning(node)) {
        suppressWarningElements.add(node);
      }
    }

    // Find loader/action function bodies
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      const name = node.name.text;
      if (name === 'loader' || name === 'action') {
        if (node.body) {
          serverFunctionBodies.add(node.body);
        }
      }
    }

    // Also check for exported variable declarations (arrow functions)
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          if (name === 'loader' || name === 'action') {
            if (decl.initializer) {
              // Get the function body from arrow function or function expression
              if (
                ts.isArrowFunction(decl.initializer) ||
                ts.isFunctionExpression(decl.initializer)
              ) {
                serverFunctionBodies.add(decl.initializer.body);
              }
            }
          }
        }
      }
    }
  });

  walkAst(sourceFile, (node) => {
    // Track useEffect boundaries
    if (isCallTo(node, 'useEffect') || isCallTo(node, 'useLayoutEffect')) {
      useEffectStack.push(node);
    }

    // Skip hydration detection for code inside loader/action functions
    const inServerFunction = isInsideServerFunction(node, serverFunctionBodies);

    // Detect hydration-risky patterns (only in client-side code)
    if (!inServerFunction) {
      const hydrationRisk = detectHydrationRisk(
        node,
        sourceFile,
        filePath,
        useEffectStack.length > 0,
        isInsideSuppressedElement(node, suppressWarningElements)
      );
      if (hydrationRisk) {
        hydrationRisks.push(hydrationRisk);
      }
    }
    // Check for Link components
    if (isJsxElementWithName(node, 'Link')) {
      const link = extractLinkReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for anchor tags with href
    if (isJsxElementWithName(node, 'a')) {
      const link = extractAnchorReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for Form components
    if (isJsxElementWithName(node, 'Form')) {
      const form = extractFormReference(node, sourceFile, filePath);
      if (form) {
        forms.push(form);
      }
    }

    // Check for redirect() calls
    if (isCallTo(node, 'redirect')) {
      const link = extractRedirectReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for useNavigate().navigate() pattern
    // This is more complex - we'd need to track the variable
    // For now, look for navigate() calls directly
    if (isCallTo(node, 'navigate')) {
      const link = extractNavigateReference(node, sourceFile, filePath);
      if (link) {
        links.push(link);
      }
    }

    // Check for data hooks
    if (isCallTo(node, 'useLoaderData')) {
      const hookRef = createDataHookReference(
        'useLoaderData',
        node,
        sourceFile,
        filePath
      );
      dataHooks.push(hookRef);
    }

    if (isCallTo(node, 'useActionData')) {
      const hookRef = createDataHookReference(
        'useActionData',
        node,
        sourceFile,
        filePath
      );
      dataHooks.push(hookRef);
    }

    if (isCallTo(node, 'useParams')) {
      const hookRef = extractUseParamsReference(node, sourceFile, filePath);
      dataHooks.push(hookRef);
    }

    // Check for loader/action exports
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (isExported(node)) {
        if (node.name.text === 'loader') {
          hasLoader = true;
        }
        if (node.name.text === 'action') {
          hasAction = true;
        }
      }
    }

    // Also check for exported variable declarations (arrow functions)
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          if (decl.name.text === 'loader') {
            hasLoader = true;
          }
          if (decl.name.text === 'action') {
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
    hydrationRisks,
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
  const toAttr = getJsxAttribute(element, 'to');
  const hrefAttr = getJsxAttribute(element, 'href');
  const attr = toAttr || hrefAttr;

  if (!attr) {
    return undefined;
  }

  const valueWithSpan = getJsxAttributeStringValueWithSpan(attr);
  if (!valueWithSpan) {
    // Complex expression we can't analyze
    return undefined;
  }

  // Skip external URLs and hash links
  if (isExternalOrHash(valueWithSpan.value)) {
    return undefined;
  }

  const pos = getLineAndColumn(sourceFile, element.getStart());

  return {
    href: valueWithSpan.value,
    isDynamic: valueWithSpan.isDynamic,
    pattern: valueWithSpan.isDynamic
      ? normalizeToPattern(valueWithSpan.value)
      : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    type: 'link',
    attributeSpan: getNodeSpan(sourceFile, valueWithSpan.valueNode, filePath),
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
  const hrefAttr = getJsxAttribute(element, 'href');
  if (!hrefAttr) {
    return undefined;
  }

  const valueWithSpan = getJsxAttributeStringValueWithSpan(hrefAttr);
  if (!valueWithSpan) {
    return undefined;
  }

  // Skip external URLs and hash links
  if (isExternalOrHash(valueWithSpan.value)) {
    return undefined;
  }

  const pos = getLineAndColumn(sourceFile, element.getStart());

  return {
    href: valueWithSpan.value,
    isDynamic: valueWithSpan.isDynamic,
    pattern: valueWithSpan.isDynamic
      ? normalizeToPattern(valueWithSpan.value)
      : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    type: 'link',
    attributeSpan: getNodeSpan(sourceFile, valueWithSpan.valueNode, filePath),
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
  const actionAttr = getJsxAttribute(element, 'action');
  const methodAttr = getJsxAttribute(element, 'method');

  let action: string | undefined;
  let actionSpan: SourceSpan | undefined;
  if (actionAttr) {
    const valueWithSpan = getJsxAttributeStringValueWithSpan(actionAttr);
    if (valueWithSpan) {
      action = valueWithSpan.value;
      actionSpan = getNodeSpan(sourceFile, valueWithSpan.valueNode, filePath);
    }
  }

  let method: FormReference['method'] = 'post';
  if (methodAttr) {
    const value = getJsxAttributeStringValue(methodAttr);
    if (value) {
      const m = value.value.toLowerCase();
      if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) {
        method = m as FormReference['method'];
      }
    }
  }

  // Extract input names and intent value from form children
  const { inputNames, intentValue } = extractFormInputNamesAndIntent(
    element,
    sourceFile
  );

  const pos = getLineAndColumn(sourceFile, element.getStart());

  return {
    action,
    method,
    inputNames,
    intentValue,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    actionSpan,
  };
}

/**
 * Extract input names and intent value from form children
 * Looks for:
 * - Input/select/textarea elements with name attribute
 * - Button elements with name="intent" and value attribute
 * - Hidden inputs with name="intent" and value attribute
 */
function extractFormInputNamesAndIntent(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  _sourceFile: ts.SourceFile
): { inputNames: string[]; intentValue: string | undefined } {
  const names: string[] = [];
  let intentValue: string | undefined;

  walkAst(element, (node) => {
    // Check for input, select, textarea, checkbox with name attribute
    // Also check PascalCase variants for UI component libraries
    if (
      isJsxElementWithName(node, 'input') ||
      isJsxElementWithName(node, 'select') ||
      isJsxElementWithName(node, 'textarea') ||
      isJsxElementWithName(node, 'Input') ||
      isJsxElementWithName(node, 'Select') ||
      isJsxElementWithName(node, 'Textarea') ||
      isJsxElementWithName(node, 'Checkbox')
    ) {
      const nameAttr = getJsxAttribute(node, 'name');
      if (nameAttr) {
        const value = getJsxAttributeStringValue(nameAttr);
        if (value) {
          names.push(value.value);

          // Check if this is an intent hidden input
          if (value.value === 'intent') {
            const valueAttr = getJsxAttribute(node, 'value');
            if (valueAttr) {
              const intentVal = getJsxAttributeStringValue(valueAttr);
              if (intentVal) {
                intentValue = intentVal.value;
              }
            }
          }
        }
      }
    }

    // Check for button with name="intent" (submit buttons that set intent)
    if (
      isJsxElementWithName(node, 'button') ||
      isJsxElementWithName(node, 'Button')
    ) {
      const nameAttr = getJsxAttribute(node, 'name');
      if (nameAttr) {
        const nameValue = getJsxAttributeStringValue(nameAttr);
        if (nameValue && nameValue.value === 'intent') {
          names.push('intent');
          const valueAttr = getJsxAttribute(node, 'value');
          if (valueAttr) {
            const intentVal = getJsxAttributeStringValue(valueAttr);
            if (intentVal) {
              intentValue = intentVal.value;
            }
          }
        }
      }
    }
  });

  return { inputNames: names, intentValue };
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

  let value:
    | { value: string; isDynamic: boolean; valueNode: ts.Node }
    | undefined;

  if (ts.isStringLiteral(arg)) {
    value = { value: arg.text, isDynamic: false, valueNode: arg };
  } else if (ts.isTemplateExpression(arg)) {
    let pattern = arg.head.text;
    for (const span of arg.templateSpans) {
      pattern += ':param' + span.literal.text;
    }
    value = { value: pattern, isDynamic: true, valueNode: arg };
  } else if (ts.isNoSubstitutionTemplateLiteral(arg)) {
    value = { value: arg.text, isDynamic: false, valueNode: arg };
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
    type: 'redirect',
    attributeSpan: getNodeSpan(sourceFile, value.valueNode, filePath),
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

  let value:
    | { value: string; isDynamic: boolean; valueNode: ts.Node }
    | undefined;

  if (ts.isStringLiteral(arg)) {
    value = { value: arg.text, isDynamic: false, valueNode: arg };
  } else if (ts.isTemplateExpression(arg)) {
    let pattern = arg.head.text;
    for (const span of arg.templateSpans) {
      pattern += ':param' + span.literal.text;
    }
    value = { value: pattern, isDynamic: true, valueNode: arg };
  } else if (ts.isNoSubstitutionTemplateLiteral(arg)) {
    value = { value: arg.text, isDynamic: false, valueNode: arg };
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
    type: 'navigate',
    attributeSpan: getNodeSpan(sourceFile, value.valueNode, filePath),
  };
}

/**
 * Create a data hook reference
 */
function createDataHookReference(
  hook: 'useLoaderData' | 'useActionData',
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
  const paramSpans = new Map<string, SourceSpan>();

  // Look at the parent - if it's a variable declaration, track property access
  const parent = call.parent;
  if (ts.isVariableDeclaration(parent)) {
    // Destructuring: const { id } = useParams()
    if (ts.isObjectBindingPattern(parent.name)) {
      for (const element of parent.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          const paramName = element.name.text;
          accessedParams.push(paramName);
          paramSpans.set(
            paramName,
            getNodeSpan(sourceFile, element.name, filePath)
          );
        }
      }
    }
  }

  return {
    hook: 'useParams',
    accessedParams: accessedParams.length > 0 ? accessedParams : undefined,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    paramSpans: paramSpans.size > 0 ? paramSpans : undefined,
  };
}

/**
 * Check if a URL is external or a hash link
 */
function isExternalOrHash(url: string): boolean {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('#') ||
    url.startsWith('//')
  );
}

/**
 * Normalize a dynamic href to a pattern for matching
 * "/employees/:param" stays the same
 */
function normalizeToPattern(href: string): string {
  return href;
}

/**
 * Check if a JSX element has suppressHydrationWarning attribute
 */
function hasSuppressHydrationWarning(
  element: ts.JsxElement | ts.JsxSelfClosingElement
): boolean {
  const attr = getJsxAttribute(element, 'suppressHydrationWarning');
  if (!attr) return false;

  // suppressHydrationWarning (no value) or suppressHydrationWarning={true}
  if (!attr.initializer) return true;

  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    if (
      attr.initializer.expression.kind === ts.SyntaxKind.TrueKeyword ||
      (ts.isIdentifier(attr.initializer.expression) &&
        attr.initializer.expression.text === 'true')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a node is inside an element with suppressHydrationWarning
 */
function isInsideSuppressedElement(
  node: ts.Node,
  suppressedElements: Set<ts.Node>
): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (suppressedElements.has(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Check if a node is inside a server-side function (loader or action)
 * Code inside these functions runs on the server and doesn't cause hydration issues
 */
function isInsideServerFunction(
  node: ts.Node,
  serverFunctionBodies: Set<ts.Node>
): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (serverFunctionBodies.has(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Detect hydration-risky patterns in a node
 */
function detectHydrationRisk(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
  inUseEffect: boolean,
  hasSuppressWarning: boolean
): HydrationRisk | undefined {
  const pos = getLineAndColumn(sourceFile, node.getStart());
  const location = { file: filePath, line: pos.line, column: pos.column };

  // Detect new Date() calls
  if (ts.isNewExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'Date') {
      return {
        type: 'date-render',
        location,
        code: node.getText(sourceFile),
        inUseEffect,
        hasSuppressWarning,
      };
    }
  }

  // Detect Date.now(), Date.parse() etc
  if (ts.isCallExpression(node)) {
    const expr = node.expression;

    // Date.now(), Date.parse()
    if (ts.isPropertyAccessExpression(expr)) {
      if (
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'Date' &&
        ['now', 'parse'].includes(expr.name.text)
      ) {
        return {
          type: 'date-render',
          location,
          code: node.getText(sourceFile),
          inUseEffect,
          hasSuppressWarning,
        };
      }

      // Math.random()
      if (
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'Math' &&
        expr.name.text === 'random'
      ) {
        return {
          type: 'random-value',
          location,
          code: node.getText(sourceFile),
          inUseEffect,
          hasSuppressWarning,
        };
      }

      // .toLocaleString(), .toLocaleDateString(), .toLocaleTimeString()
      if (
        ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].includes(
          expr.name.text
        )
      ) {
        // Check if options with timeZone are provided
        if (!hasTimezoneOption(node)) {
          return {
            type: 'locale-format',
            location,
            code: node.getText(sourceFile),
            inUseEffect,
            hasSuppressWarning,
            callSpan: getNodeSpan(sourceFile, node, filePath),
            argCount: node.arguments?.length ?? 0,
          };
        }
      }
    }

    // uuid(), nanoid(), crypto.randomUUID()
    if (ts.isIdentifier(expr)) {
      if (['uuid', 'nanoid', 'uuidv4', 'generateId'].includes(expr.text)) {
        return {
          type: 'random-value',
          location,
          code: node.getText(sourceFile),
          inUseEffect,
          hasSuppressWarning,
          callSpan: getNodeSpan(sourceFile, node, filePath),
        };
      }
    }
  }

  // new Intl.DateTimeFormat without timeZone
  if (ts.isNewExpression(node)) {
    const newExpr = node.expression;
    if (
      ts.isPropertyAccessExpression(newExpr) &&
      ts.isIdentifier(newExpr.expression) &&
      newExpr.expression.text === 'Intl' &&
      newExpr.name.text === 'DateTimeFormat'
    ) {
      if (!hasTimezoneOption(node)) {
        return {
          type: 'locale-format',
          location,
          code: node.getText(sourceFile),
          inUseEffect,
          hasSuppressWarning,
          callSpan: getNodeSpan(sourceFile, node, filePath),
          argCount: node.arguments?.length ?? 0,
        };
      }
    }
  }

  // Detect browser-only API access: window, localStorage, sessionStorage, document
  if (ts.isIdentifier(node)) {
    const browserApis = [
      'window',
      'localStorage',
      'sessionStorage',
      'document',
      'navigator',
      'location',
    ];
    if (browserApis.includes(node.text)) {
      // Make sure it's an access, not a declaration or type
      const parent = node.parent;
      if (
        parent &&
        !ts.isTypeReferenceNode(parent) &&
        !ts.isVariableDeclaration(parent) &&
        !ts.isParameter(parent)
      ) {
        // Check if it's actually being accessed (e.g., window.innerWidth)
        if (
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === node
        ) {
          return {
            type: 'browser-api',
            location,
            code: parent.getText(sourceFile),
            inUseEffect,
            hasSuppressWarning,
            callSpan: getNodeSpan(sourceFile, parent, filePath),
          };
        }
      }
    }
  }

  return undefined;
}

/**
 * Check if a call expression has timeZone option in its arguments
 */
function hasTimezoneOption(
  call: ts.CallExpression | ts.NewExpression
): boolean {
  const args = call.arguments;
  if (!args || args.length < 2) return false;

  // Look for options object with timeZone property
  const optionsArg = args[1];
  if (ts.isObjectLiteralExpression(optionsArg)) {
    for (const prop of optionsArg.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        if (prop.name.text === 'timeZone') {
          return true;
        }
      }
    }
  }

  return false;
}
