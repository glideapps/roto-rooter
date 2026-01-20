import * as fs from 'fs';
import ts from 'typescript';
import type { AnalyzerIssue, SourceLocation } from '../types.js';
import {
  parseFile,
  walkAst,
  getJsxTagName,
  getJsxAttribute,
  getJsxTextContent,
  getLineAndColumn,
  isPascalCase,
} from '../utils/ast-utils.js';

/**
 * Dialog container component names to detect
 */
const DIALOG_CONTAINERS = new Set([
  'Dialog',
  'Modal',
  'AlertDialog',
  'ConfirmDialog',
  'ConfirmationDialog',
  'Sheet',
  'Drawer',
  'Popover',
]);

/**
 * Action button text patterns (case-insensitive match at start of text)
 */
const ACTION_BUTTON_PATTERNS = [
  /^save/i,
  /^submit/i,
  /^delete/i,
  /^remove/i,
  /^add/i,
  /^create/i,
  /^update/i,
  /^confirm/i,
  /^apply/i,
];

/**
 * Cancel/dismiss button text patterns (should NOT be flagged)
 */
const CANCEL_BUTTON_PATTERNS = [/^cancel/i, /^close/i, /^dismiss/i, /^no$/i];

/**
 * Native HTML form input element names
 */
const NATIVE_INPUT_ELEMENTS = new Set(['input', 'select', 'textarea']);

/**
 * Information about a button within a dialog
 */
interface DialogButton {
  text: string;
  location: SourceLocation;
  code: string;
  handlerBehavior: 'closes-dialog' | 'stub' | 'submits' | 'unknown';
}

/**
 * Information about a dialog/modal container
 */
interface DialogContext {
  type: string;
  location: SourceLocation;
  hasPlainInputs: boolean;
  hasReactRouterForm: boolean;
  hasFetcherSubmit: boolean;
  actionButtons: DialogButton[];
}

/**
 * Information about a standalone button (not in a dialog)
 */
interface StandaloneButton {
  text: string;
  location: SourceLocation;
  code: string;
  handlerBehavior: 'stub' | 'submits' | 'unknown';
}

/**
 * Check for disconnected interactive elements (dialogs with fake submit buttons)
 */
export function checkInteractivity(files: string[]): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const sourceFile = parseFile(file, content);

      // Find all useState setters in this file
      const stateSetters = findStateSetters(sourceFile);

      // Find all stub handler functions defined in this file
      const stubHandlers = findStubHandlers(sourceFile);

      // Check for useFetcher usage in the file
      const hasFetcherInFile = checkForFetcherUsage(sourceFile);

      // Find and analyze all dialog containers
      const dialogs = findDialogContexts(
        sourceFile,
        file,
        stateSetters,
        hasFetcherInFile
      );

      // Generate issues for problematic dialogs
      for (const dialog of dialogs) {
        const dialogIssues = validateDialog(dialog);
        issues.push(...dialogIssues);
      }

      // Find standalone action buttons with stub handlers (not in dialogs)
      const standaloneButtons = findStandaloneStubButtons(
        sourceFile,
        file,
        stateSetters,
        stubHandlers,
        dialogs
      );

      for (const button of standaloneButtons) {
        if (button.handlerBehavior === 'stub') {
          issues.push({
            category: 'interactivity',
            severity: 'warning',
            message: `"${button.text}" button has an empty or stub onClick handler`,
            location: button.location,
            code: button.code,
            suggestion: 'Implement the handler to perform the intended action',
          });
        }
      }
    } catch {
      // File doesn't exist or can't be parsed - skip it
    }
  }

  return issues;
}

/**
 * Find all useState setter function names in a source file
 */
function findStateSetters(sourceFile: ts.SourceFile): Set<string> {
  const setters = new Set<string>();

  walkAst(sourceFile, (node) => {
    // Look for: const [value, setValue] = useState(...)
    if (ts.isVariableDeclaration(node)) {
      if (ts.isArrayBindingPattern(node.name) && node.initializer) {
        if (isUseStateCall(node.initializer)) {
          const elements = node.name.elements;
          if (elements.length >= 2) {
            const setter = elements[1];
            if (ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) {
              setters.add(setter.name.text);
            }
          }
        }
      }
    }
  });

  return setters;
}

/**
 * Check if an expression is a useState() call
 */
function isUseStateCall(node: ts.Node): boolean {
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    if (ts.isIdentifier(expr) && expr.text === 'useState') {
      return true;
    }
  }
  return false;
}

/**
 * Check if the file uses useFetcher
 */
function checkForFetcherUsage(sourceFile: ts.SourceFile): boolean {
  let hasFetcher = false;

  walkAst(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === 'useFetcher') {
        hasFetcher = true;
      }
    }
  });

  return hasFetcher;
}

/**
 * Find all dialog containers and analyze their contents
 */
function findDialogContexts(
  sourceFile: ts.SourceFile,
  filePath: string,
  stateSetters: Set<string>,
  hasFetcherInFile: boolean
): DialogContext[] {
  const dialogs: DialogContext[] = [];

  walkAst(sourceFile, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node);
      if (tagName && DIALOG_CONTAINERS.has(tagName)) {
        const context = analyzeDialogContext(
          node,
          tagName,
          sourceFile,
          filePath,
          stateSetters,
          hasFetcherInFile
        );
        dialogs.push(context);
      }
    }
  });

  return dialogs;
}

/**
 * Analyze a dialog container's contents
 */
function analyzeDialogContext(
  dialogNode: ts.JsxElement | ts.JsxSelfClosingElement,
  dialogType: string,
  sourceFile: ts.SourceFile,
  filePath: string,
  stateSetters: Set<string>,
  hasFetcherInFile: boolean
): DialogContext {
  const pos = getLineAndColumn(sourceFile, dialogNode.getStart());
  const location: SourceLocation = {
    file: filePath,
    line: pos.line,
    column: pos.column,
  };

  let hasPlainInputs = false;
  let hasReactRouterForm = false;
  const hasFetcherSubmit = hasFetcherInFile; // If fetcher is used anywhere, give benefit of doubt
  const actionButtons: DialogButton[] = [];

  // Track if we're inside a Form element
  const formStack: ts.Node[] = [];

  walkAst(dialogNode, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node);
      if (!tagName) return;

      // Track Form elements
      if (tagName === 'Form') {
        hasReactRouterForm = true;
        formStack.push(node);
      }

      // Check for form inputs NOT inside a Form
      if (isFormInputElement(node, tagName) && formStack.length === 0) {
        hasPlainInputs = true;
      }

      // Check for buttons
      if (tagName === 'button' || tagName === 'Button') {
        const buttonInfo = analyzeButton(
          node,
          sourceFile,
          filePath,
          stateSetters
        );
        if (buttonInfo && isActionButton(buttonInfo.text)) {
          actionButtons.push(buttonInfo);
        }
      }
    }
  });

  return {
    type: dialogType,
    location,
    hasPlainInputs,
    hasReactRouterForm,
    hasFetcherSubmit,
    actionButtons,
  };
}

/**
 * Check if a JSX element is a form input
 */
function isFormInputElement(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  tagName: string
): boolean {
  // Native HTML form inputs
  if (NATIVE_INPUT_ELEMENTS.has(tagName)) {
    return true;
  }

  // PascalCase component with name prop (UI library components)
  if (isPascalCase(tagName)) {
    const nameAttr = getJsxAttribute(node, 'name');
    return nameAttr !== undefined;
  }

  return false;
}

/**
 * Analyze a button element
 */
function analyzeButton(
  buttonNode: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string,
  stateSetters: Set<string>
): DialogButton | undefined {
  // Get button text
  const text = getJsxTextContent(buttonNode);
  if (!text) return undefined;

  // Get onClick handler
  const onClickAttr = getJsxAttribute(buttonNode, 'onClick');
  let handlerBehavior: DialogButton['handlerBehavior'] = 'unknown';

  if (onClickAttr?.initializer) {
    handlerBehavior = classifyOnClickHandler(
      onClickAttr.initializer,
      stateSetters
    );
  }

  const pos = getLineAndColumn(sourceFile, buttonNode.getStart());

  return {
    text,
    location: {
      file: filePath,
      line: pos.line,
      column: pos.column,
    },
    code: `<Button onClick={...}>${text}</Button>`,
    handlerBehavior,
  };
}

/**
 * Classify what an onClick handler does
 */
function classifyOnClickHandler(
  initializer: ts.JsxAttributeValue,
  stateSetters: Set<string>
): DialogButton['handlerBehavior'] {
  // onClick={expression}
  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    return 'unknown';
  }

  const expr = initializer.expression;

  // Arrow function: () => ...
  if (ts.isArrowFunction(expr)) {
    return classifyArrowFunctionBody(expr.body, stateSetters);
  }

  // Function reference: onClick={handleSave}
  // We can't easily trace this without more complex analysis
  // Be conservative and return unknown
  return 'unknown';
}

/**
 * Classify what an arrow function body does
 */
function classifyArrowFunctionBody(
  body: ts.ConciseBody,
  stateSetters: Set<string>
): DialogButton['handlerBehavior'] {
  // Expression body: () => setSomething(false)
  if (ts.isCallExpression(body)) {
    return classifyCallExpression(body, stateSetters);
  }

  // Block body: () => { ... }
  if (ts.isBlock(body)) {
    const statements = body.statements;

    // Empty block
    if (statements.length === 0) {
      return 'stub';
    }

    // Check if all statements are just closing dialog or console.log
    let allClosesDialog = true;
    let allStub = true;
    let hasSubmit = false;

    for (const stmt of statements) {
      if (ts.isExpressionStatement(stmt)) {
        const classification = classifyExpression(
          stmt.expression,
          stateSetters
        );
        if (classification === 'submits') {
          hasSubmit = true;
        }
        if (classification !== 'closes-dialog') {
          allClosesDialog = false;
        }
        if (classification !== 'stub') {
          allStub = false;
        }
      } else {
        // Other statement types (if, return, etc.) - unknown
        allClosesDialog = false;
        allStub = false;
      }
    }

    if (hasSubmit) return 'submits';
    if (allClosesDialog) return 'closes-dialog';
    if (allStub) return 'stub';
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Classify a call expression
 */
function classifyCallExpression(
  call: ts.CallExpression,
  stateSetters: Set<string>
): DialogButton['handlerBehavior'] {
  const callee = call.expression;

  // Check for setState(false) - closes dialog
  if (ts.isIdentifier(callee) && stateSetters.has(callee.text)) {
    const arg = call.arguments[0];
    if (arg && arg.kind === ts.SyntaxKind.FalseKeyword) {
      return 'closes-dialog';
    }
    // setState with other values is unknown
    return 'unknown';
  }

  // Check for console.log - stub
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'console' &&
    callee.name.text === 'log'
  ) {
    return 'stub';
  }

  // Check for fetcher.submit() or submit()
  if (ts.isIdentifier(callee) && callee.text === 'submit') {
    return 'submits';
  }
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'submit') {
    return 'submits';
  }

  return 'unknown';
}

/**
 * Classify an expression statement
 */
function classifyExpression(
  expr: ts.Expression,
  stateSetters: Set<string>
): DialogButton['handlerBehavior'] {
  if (ts.isCallExpression(expr)) {
    return classifyCallExpression(expr, stateSetters);
  }
  return 'unknown';
}

/**
 * Check if button text indicates an action button
 */
function isActionButton(text: string): boolean {
  // First check if it's a cancel/dismiss button
  for (const pattern of CANCEL_BUTTON_PATTERNS) {
    if (pattern.test(text)) {
      return false;
    }
  }

  // Then check if it matches action patterns
  for (const pattern of ACTION_BUTTON_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a dialog context and generate issues
 */
function validateDialog(dialog: DialogContext): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  // Skip if dialog uses React Router Form or fetcher
  if (dialog.hasReactRouterForm || dialog.hasFetcherSubmit) {
    return issues;
  }

  for (const button of dialog.actionButtons) {
    // Only flag buttons that clearly just close the dialog
    if (button.handlerBehavior === 'closes-dialog') {
      // Determine if this is a data-loss scenario (edit dialog) or misleading action (delete dialog)
      const isDestructive = /^(delete|remove)/i.test(button.text);

      if (dialog.hasPlainInputs) {
        // Dialog has form inputs but Save/Submit button only closes
        issues.push({
          category: 'interactivity',
          severity: 'error',
          message: `"${button.text}" button in ${dialog.type} only closes dialog without saving data`,
          location: button.location,
          code: button.code,
          suggestion:
            'Wrap inputs in a <Form> component or use useFetcher.submit() to persist data',
        });
      } else if (isDestructive) {
        // Delete/Remove confirmation that doesn't actually delete
        issues.push({
          category: 'interactivity',
          severity: 'error',
          message: `"${button.text}" button in ${dialog.type} only closes dialog without performing the action`,
          location: button.location,
          code: button.code,
          suggestion:
            'Use useFetcher.submit() with a delete intent or wrap in a <Form method="delete">',
        });
      }
    } else if (button.handlerBehavior === 'stub') {
      // Button has empty/console.log handler
      issues.push({
        category: 'interactivity',
        severity: 'warning',
        message: `"${button.text}" button has an empty or stub onClick handler`,
        location: button.location,
        code: button.code,
        suggestion: 'Implement the handler or remove the button if not needed',
      });
    }
  }

  return issues;
}

/**
 * Find all function declarations/expressions that are stub handlers
 * (only contain console.log or are empty)
 */
function findStubHandlers(sourceFile: ts.SourceFile): Set<string> {
  const stubs = new Set<string>();

  walkAst(sourceFile, (node) => {
    // Arrow function assigned to const: const handleAdd = () => { console.log(...) }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (node.initializer && ts.isArrowFunction(node.initializer)) {
        if (isStubFunctionBody(node.initializer.body)) {
          stubs.add(name);
        }
      }
    }

    // Function declaration: function handleAdd() { console.log(...) }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      if (isStubFunctionBody(node.body)) {
        stubs.add(node.name.text);
      }
    }
  });

  return stubs;
}

/**
 * Check if a function body is a stub (empty or only console.log)
 */
function isStubFunctionBody(body: ts.ConciseBody): boolean {
  // Expression body: () => console.log(...)
  if (ts.isCallExpression(body)) {
    return isConsoleLog(body);
  }

  // Block body: () => { ... }
  if (ts.isBlock(body)) {
    const statements = body.statements;

    // Empty block
    if (statements.length === 0) {
      return true;
    }

    // Only console.log statements
    return statements.every((stmt) => {
      if (
        ts.isExpressionStatement(stmt) &&
        ts.isCallExpression(stmt.expression)
      ) {
        return isConsoleLog(stmt.expression);
      }
      return false;
    });
  }

  return false;
}

/**
 * Check if a call expression is console.log/warn/error
 */
function isConsoleLog(call: ts.CallExpression): boolean {
  const callee = call.expression;
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'console'
  ) {
    return ['log', 'warn', 'error', 'info', 'debug'].includes(callee.name.text);
  }
  return false;
}

/**
 * Find standalone buttons (not in dialogs) with stub handlers
 */
function findStandaloneStubButtons(
  sourceFile: ts.SourceFile,
  filePath: string,
  stateSetters: Set<string>,
  stubHandlers: Set<string>,
  _dialogs: DialogContext[]
): StandaloneButton[] {
  const buttons: StandaloneButton[] = [];

  // Get the source ranges of all dialogs to skip buttons inside them
  const dialogRanges: Array<{ start: number; end: number }> = [];
  walkAst(sourceFile, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node);
      if (tagName && DIALOG_CONTAINERS.has(tagName)) {
        dialogRanges.push({
          start: node.getStart(),
          end: node.getEnd(),
        });
      }
    }
  });

  walkAst(sourceFile, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node);
      if (!tagName) return;

      // Check for button-like elements
      const isButtonElement =
        tagName === 'button' ||
        tagName === 'Button' ||
        tagName.endsWith('Button');

      if (!isButtonElement) return;

      // Skip if inside a dialog
      const nodeStart = node.getStart();
      const isInsideDialog = dialogRanges.some(
        (range) => nodeStart >= range.start && nodeStart <= range.end
      );
      if (isInsideDialog) return;

      // Get button text
      const text = getJsxTextContent(node);
      if (!text || !isActionButton(text)) return;

      // Analyze onClick handler
      const onClickAttr = getJsxAttribute(node, 'onClick');
      if (!onClickAttr?.initializer) return;

      const handlerBehavior = classifyOnClickHandlerWithFunctionLookup(
        onClickAttr.initializer,
        stateSetters,
        stubHandlers
      );

      if (handlerBehavior === 'stub') {
        const pos = getLineAndColumn(sourceFile, node.getStart());
        buttons.push({
          text,
          location: {
            file: filePath,
            line: pos.line,
            column: pos.column,
          },
          code: `<${tagName} onClick={...}>${text}</${tagName}>`,
          handlerBehavior,
        });
      }
    }
  });

  return buttons;
}

/**
 * Classify onClick handler, also checking for known stub function references
 */
function classifyOnClickHandlerWithFunctionLookup(
  initializer: ts.JsxAttributeValue,
  stateSetters: Set<string>,
  stubHandlers: Set<string>
): StandaloneButton['handlerBehavior'] {
  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    return 'unknown';
  }

  const expr = initializer.expression;

  // Arrow function: () => ...
  if (ts.isArrowFunction(expr)) {
    const classification = classifyArrowFunctionBody(expr.body, stateSetters);
    if (classification === 'stub') return 'stub';
    if (classification === 'submits') return 'submits';
    return 'unknown';
  }

  // Function reference: onClick={handleAdd}
  if (ts.isIdentifier(expr)) {
    if (stubHandlers.has(expr.text)) {
      return 'stub';
    }
  }

  return 'unknown';
}
