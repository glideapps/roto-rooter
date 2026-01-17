// Public API exports
export { analyze } from './analyzer.js';
export {
  parseRoutes,
  getAllRoutePaths,
  matchRoute,
  matchDynamicPattern,
} from './parsers/route-parser.js';
export { parseComponent } from './parsers/component-parser.js';
export { parseRouteExports } from './parsers/action-parser.js';
export { checkLinks } from './checks/link-check.js';
export { checkForms } from './checks/form-check.js';
export { checkLoaders } from './checks/loader-check.js';
export { checkParams } from './checks/params-check.js';

export type {
  RouteDefinition,
  LinkReference,
  FormReference,
  DataHookReference,
  ComponentAnalysis,
  SourceLocation,
  AnalyzerIssue,
  AnalyzerResult,
  CliOptions,
} from './types.js';
